from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from creditwise.settings import ID_COLUMN, TARGET_COLUMN

NUMERIC_FEATURES = [
    "Applicant_Income",
    "Coapplicant_Income",
    "Age",
    "Dependents",
    "Credit_Score",
    "Existing_Loans",
    "DTI_Ratio",
    "Savings",
    "Collateral_Value",
    "Loan_Amount",
    "Loan_Term",
]

CATEGORICAL_FEATURES = [
    "Employment_Status",
    "Marital_Status",
    "Loan_Purpose",
    "Property_Area",
    "Education_Level",
    "Gender",
    "Employer_Category",
]

MODEL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
PUBLIC_MODEL_FEATURES = [
    feature for feature in MODEL_FEATURES if feature not in {"Age", "Marital_Status", "Gender"}
]

EXPECTED_COLUMNS = [ID_COLUMN, *MODEL_FEATURES, TARGET_COLUMN]
TARGET_MAP = {"yes": 1, "no": 0}


@dataclass(frozen=True)
class DatasetProfile:
    path: str
    sha256: str
    rows: int
    columns: int
    labeled_rows: int
    missing_targets: int
    positive_rows: int
    negative_rows: int

    def as_dict(self) -> dict[str, object]:
        return self.__dict__.copy()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_dataset(path: Path) -> tuple[pd.DataFrame, DatasetProfile]:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    frame = pd.read_csv(path)
    missing_columns = sorted(set(EXPECTED_COLUMNS) - set(frame.columns))
    if missing_columns:
        raise ValueError(f"Dataset is missing columns: {', '.join(missing_columns)}")

    frame = frame[EXPECTED_COLUMNS].copy()
    for feature in CATEGORICAL_FEATURES:
        cleaned = frame[feature].astype("string").str.strip()
        frame[feature] = cleaned.astype(object).where(cleaned.notna(), np.nan)

    normalized_target = frame[TARGET_COLUMN].astype("string").str.strip().str.lower()
    invalid_targets = normalized_target.notna() & ~normalized_target.isin(TARGET_MAP)
    if invalid_targets.any():
        values = sorted(normalized_target[invalid_targets].dropna().unique().tolist())
        raise ValueError(f"Unexpected target values: {values}")

    frame[TARGET_COLUMN] = normalized_target.map(TARGET_MAP).astype("Int64")
    labeled = frame[frame[TARGET_COLUMN].notna()].copy()
    labeled[TARGET_COLUMN] = labeled[TARGET_COLUMN].astype(int)

    profile = DatasetProfile(
        path=str(path.resolve()),
        sha256=sha256_file(path),
        rows=len(frame),
        columns=len(frame.columns),
        labeled_rows=len(labeled),
        missing_targets=int(frame[TARGET_COLUMN].isna().sum()),
        positive_rows=int(labeled[TARGET_COLUMN].sum()),
        negative_rows=int((labeled[TARGET_COLUMN] == 0).sum()),
    )
    return frame, profile


def labeled_xy(frame: pd.DataFrame, *, public_policy: bool = False) -> tuple[pd.DataFrame, pd.Series]:
    labeled = frame[frame[TARGET_COLUMN].notna()].copy()
    features = PUBLIC_MODEL_FEATURES if public_policy else MODEL_FEATURES
    return labeled[features], labeled[TARGET_COLUMN].astype(int)
