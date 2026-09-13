from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from fastapi import HTTPException

from creditwise.data import (
    CATEGORICAL_FEATURES,
    MODEL_FEATURES,
    NUMERIC_FEATURES,
    PUBLIC_MODEL_FEATURES,
)
from creditwise.features import FinancialFeatureEngineer
from creditwise.settings import TARGET_COLUMN

DISPLAY_NAMES = {
    name: name.replace("_", " ")
    for name in [
        *MODEL_FEATURES,
        "Total_Income",
        "Loan_to_Income",
        "Savings_to_Loan",
        "Collateral_to_Loan",
    ]
}
DERIVED_DEFINITIONS = {
    "Total_Income": "Applicant income + coapplicant income",
    "Loan_to_Income": "Loan amount / total income",
    "Savings_to_Loan": "Savings / loan amount",
    "Collateral_to_Loan": "Collateral value / loan amount",
}
DERIVED_FEATURES = list(DERIVED_DEFINITIONS)
EXPLORER_NUMERIC_FEATURES = [*NUMERIC_FEATURES, *DERIVED_FEATURES]
EXPLORER_CATEGORICAL_FEATURES = CATEGORICAL_FEATURES
EXPLORER_FEATURES = [*EXPLORER_NUMERIC_FEATURES, *EXPLORER_CATEGORICAL_FEATURES]


def explorer_frame(frame: pd.DataFrame) -> pd.DataFrame:
    engineered = FinancialFeatureEngineer().transform(frame[MODEL_FEATURES])
    result = frame.copy()
    for feature in DERIVED_FEATURES:
        result[feature] = engineered[feature]
    return result


def _clean_value(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        return round(float(value), 6)
    return value


def validate_feature(feature: str, *, categorical_only: bool = False) -> str:
    allowed = EXPLORER_CATEGORICAL_FEATURES if categorical_only else EXPLORER_FEATURES
    if feature not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported feature: {feature}")
    return feature


def apply_cohort(
    frame: pd.DataFrame, filter_feature: str | None, filter_value: str | None
) -> pd.DataFrame:
    if not filter_feature and not filter_value:
        return frame
    if not filter_feature or filter_value is None:
        raise HTTPException(
            status_code=400, detail="Both filter_feature and filter_value are required."
        )
    validate_feature(filter_feature, categorical_only=True)
    available = frame[filter_feature].dropna().astype(str).unique().tolist()
    if filter_value not in available:
        raise HTTPException(
            status_code=400, detail=f"Unknown value for {filter_feature}: {filter_value}"
        )
    return frame[frame[filter_feature].astype(str) == filter_value].copy()


def schema_payload(frame: pd.DataFrame) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for feature in EXPLORER_FEATURES:
        series = frame[feature]
        row: dict[str, Any] = {
            "feature": feature,
            "display_name": DISPLAY_NAMES[feature],
            "kind": "numeric" if feature in EXPLORER_NUMERIC_FEATURES else "categorical",
            "used_by_model": feature in PUBLIC_MODEL_FEATURES,
            "derived": feature in DERIVED_FEATURES,
            "definition": DERIVED_DEFINITIONS.get(feature),
            "missing": int(series.isna().sum()),
            "missing_rate": round(float(series.isna().mean()), 6),
        }
        valid = series.dropna()
        if feature in EXPLORER_NUMERIC_FEATURES:
            row["summary"] = {
                "min": _clean_value(valid.min()) if len(valid) else None,
                "median": _clean_value(valid.median()) if len(valid) else None,
                "max": _clean_value(valid.max()) if len(valid) else None,
            }
        else:
            row["categories"] = sorted(valid.astype(str).unique().tolist())
        rows.append(row)
    return rows


def preview_payload(frame: pd.DataFrame, *, offset: int, limit: int) -> dict[str, Any]:
    columns = MODEL_FEATURES
    rows = []
    for index, (_, record) in enumerate(
        frame.iloc[offset : offset + limit].iterrows(), start=offset + 1
    ):
        row = {"record": f"Record {index:04d}"}
        row.update({feature: _clean_value(record[feature]) for feature in columns})
        row[TARGET_COLUMN] = (
            "Approved"
            if record[TARGET_COLUMN] == 1
            else "Not approved"
            if record[TARGET_COLUMN] == 0
            else "Unknown"
        )
        rows.append(row)
    return {
        "total": len(frame),
        "offset": offset,
        "limit": limit,
        "columns": ["record", *columns, TARGET_COLUMN],
        "rows": rows,
    }


def _outcome_counts(
    frame: pd.DataFrame, label: str, low: float | None = None, high: float | None = None
) -> dict[str, Any]:
    target = frame[TARGET_COLUMN]
    result: dict[str, Any] = {
        "label": label,
        "all": len(frame),
        "approved": int((target == 1).sum()),
        "not_approved": int((target == 0).sum()),
        "unknown": int(target.isna().sum()),
    }
    if low is not None:
        result.update({"low": low, "high": high})
    return result


def distribution_payload(frame: pd.DataFrame, feature: str, bins: int) -> dict[str, Any]:
    validate_feature(feature)
    series = frame[feature]
    base = {
        "feature": feature,
        "display_name": DISPLAY_NAMES[feature],
        "kind": "numeric" if feature in EXPLORER_NUMERIC_FEATURES else "categorical",
        "total": len(frame),
        "valid": int(series.notna().sum()),
        "missing": int(series.isna().sum()),
    }
    working = frame[series.notna()].copy()
    if feature in EXPLORER_CATEGORICAL_FEATURES:
        data = [
            _outcome_counts(working[working[feature].astype(str) == category], category)
            for category in sorted(working[feature].astype(str).unique().tolist())
        ]
        return {**base, "series": data}
    numeric = pd.to_numeric(working[feature], errors="coerce")
    working = working[numeric.notna()].copy()
    numeric = numeric[numeric.notna()]
    if numeric.empty:
        return {**base, "series": []}
    if numeric.nunique() <= bins:
        data = [
            _outcome_counts(working[numeric == value], f"{value:g}", float(value), float(value))
            for value in np.sort(numeric.unique())
        ]
    else:
        cuts, _ = pd.cut(numeric, bins=bins, duplicates="drop", retbins=True, include_lowest=True)
        working["_bin"] = cuts
        data = [
            _outcome_counts(
                group,
                f"{interval.left:,.2f}–{interval.right:,.2f}",
                float(interval.left),
                float(interval.right),
            )
            for interval, group in working.groupby("_bin", observed=True)
        ]
    return {**base, "series": data}


def relationship_payload(frame: pd.DataFrame, x: str, y: str, limit: int) -> dict[str, Any]:
    validate_feature(x)
    validate_feature(y)
    if x not in EXPLORER_NUMERIC_FEATURES or y not in EXPLORER_NUMERIC_FEATURES:
        raise HTTPException(status_code=400, detail="Relationship axes must be numeric features.")
    valid = frame[[x, y, TARGET_COLUMN]].dropna(subset=[x, y]).copy()
    full_count = len(valid)
    if len(valid) > limit:
        valid = valid.sample(n=limit, random_state=42).sort_index()

    def outcome_label(value: Any) -> str:
        if pd.isna(value):
            return "Unknown"
        return "Approved" if value == 1 else "Not approved"

    points = [
        {
            "x": _clean_value(row[x]),
            "y": _clean_value(row[y]),
            "outcome": outcome_label(row[TARGET_COLUMN]),
        }
        for _, row in valid.iterrows()
    ]
    corr_source = frame[[x, y]].dropna()
    correlation = float(corr_source[x].corr(corr_source[y])) if len(corr_source) > 1 else None
    return {
        "x": x,
        "y": y,
        "x_label": DISPLAY_NAMES[x],
        "y_label": DISPLAY_NAMES[y],
        "cohort_rows": len(frame),
        "full_count": full_count,
        "shown_count": len(points),
        "missing_count": len(frame) - full_count,
        "correlation": round(correlation, 4)
        if correlation is not None and not np.isnan(correlation)
        else None,
        "points": points,
    }


def groups_payload(frame: pd.DataFrame, feature: str) -> dict[str, Any]:
    validate_feature(feature, categorical_only=True)
    rows = []
    for category in sorted(frame[feature].dropna().astype(str).unique().tolist()):
        group = frame[frame[feature].astype(str) == category]
        labeled = group[group[TARGET_COLUMN].notna()]
        approved = int((labeled[TARGET_COLUMN] == 1).sum())
        rows.append(
            {
                "label": category,
                "total": len(group),
                "labeled": len(labeled),
                "approved": approved,
                "not_approved": int((labeled[TARGET_COLUMN] == 0).sum()),
                "unknown": int(group[TARGET_COLUMN].isna().sum()),
                "approval_rate": round(float(approved / len(labeled)), 6) if len(labeled) else None,
            }
        )
    return {
        "feature": feature,
        "display_name": DISPLAY_NAMES[feature],
        "total": len(frame),
        "groups": rows,
    }
