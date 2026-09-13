from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from creditwise.data import labeled_xy, load_dataset
from creditwise.modeling import threshold_metrics
from creditwise.settings import DEFAULT_DATA_PATH, DEFAULT_MODEL_PATH, PROJECT_ROOT
from creditwise.training import split_data

DEFAULT_JSON_PATH = PROJECT_ROOT / "docs" / "model_diagnostics.json"
DEFAULT_MARKDOWN_PATH = PROJECT_ROOT / "docs" / "MODEL_DIAGNOSTICS.md"


def _calibration_bins(y_true: pd.Series, probabilities: np.ndarray, count: int = 10) -> list[dict[str, Any]]:
    frame = pd.DataFrame({"label": np.asarray(y_true), "score": probabilities})
    frame["bin"] = pd.qcut(frame["score"], q=count, duplicates="drop")
    rows: list[dict[str, Any]] = []
    for interval, group in frame.groupby("bin", observed=True):
        rows.append(
            {
                "range": f"{interval.left:.3f}–{interval.right:.3f}",
                "rows": len(group),
                "mean_score": float(group["score"].mean()),
                "observed_rate": float(group["label"].mean()),
                "absolute_gap": float(abs(group["score"].mean() - group["label"].mean())),
            }
        )
    return rows


def _coefficient_rows(pipeline: Any) -> dict[str, list[dict[str, Any]]]:
    preprocessor = pipeline.named_steps["preprocessor"]
    classifier = pipeline.named_steps["classifier"]
    names = preprocessor.get_feature_names_out()
    coefficients = classifier.coef_[0]
    rows = [
        {"feature": str(name), "coefficient": float(value)}
        for name, value in zip(names, coefficients, strict=True)
        if not np.isclose(value, 0.0)
    ]
    return {
        "positive": sorted(rows, key=lambda row: row["coefficient"], reverse=True)[:10],
        "negative": sorted(rows, key=lambda row: row["coefficient"])[:10],
    }


def _slice_rows(
    X_test: pd.DataFrame, y_test: pd.Series, predictions: np.ndarray
) -> list[dict[str, Any]]:
    observed = X_test.copy()
    observed["label"] = np.asarray(y_test)
    observed["prediction"] = predictions
    slices: list[tuple[str, pd.Series]] = []

    for feature in ("Credit_Score", "DTI_Ratio", "Loan_Amount"):
        bands = pd.qcut(observed[feature], q=4, duplicates="drop")
        slices.append((feature, bands.astype("string").fillna("Missing")))
    for feature in ("Employment_Status", "Loan_Purpose", "Property_Area"):
        slices.append((feature, observed[feature].astype("string").fillna("Missing")))

    rows: list[dict[str, Any]] = []
    for feature, values in slices:
        for value in sorted(values.unique()):
            group = observed[values == value]
            if len(group) < 50:
                continue
            negative = group["label"] == 0
            positive = group["label"] == 1
            fp = int((negative & (group["prediction"] == 1)).sum())
            fn = int((positive & (group["prediction"] == 0)).sum())
            rows.append(
                {
                    "feature": feature,
                    "group": str(value),
                    "rows": len(group),
                    "negative_rows": int(negative.sum()),
                    "positive_rows": int(positive.sum()),
                    "false_positive_rate": float(fp / negative.sum()) if negative.any() else None,
                    "false_negative_rate": float(fn / positive.sum()) if positive.any() else None,
                }
            )
    return rows


def build_diagnostics(data_path: Path, model_path: Path) -> dict[str, Any]:
    bundle = joblib.load(model_path)
    frame, profile = load_dataset(data_path)
    X, y = labeled_xy(frame)
    _, _, X_test, _, _, y_test, _, _, _ = split_data(X, y)
    features = bundle["feature_order"]
    pipeline = bundle["pipeline"]
    threshold = float(bundle["threshold"])
    probabilities = pipeline.predict_proba(X_test[features])[:, 1]
    predictions = (probabilities >= threshold).astype(int)

    thresholds = sorted({0.30, 0.40, round(threshold, 3), 0.50, 0.60, 0.70})
    calibration = _calibration_bins(y_test, probabilities)
    slices = _slice_rows(X_test, y_test, predictions)
    return {
        "model_version": bundle["metadata"]["model_version"],
        "dataset_sha256": profile.sha256,
        "split_seed": bundle["metadata"]["split"]["seed"],
        "test_rows": len(y_test),
        "selected_threshold": threshold,
        "selected_threshold_metrics": threshold_metrics(y_test, probabilities, threshold),
        "threshold_tradeoffs": [threshold_metrics(y_test, probabilities, value) for value in thresholds],
        "calibration_bins": calibration,
        "expected_calibration_error": float(
            sum(row["rows"] * row["absolute_gap"] for row in calibration) / len(y_test)
        ),
        "coefficients": _coefficient_rows(pipeline),
        "error_slices": slices,
    }


def _percent(value: float | None) -> str:
    return "—" if value is None else f"{100 * value:.1f}%"


def _coefficient_table(rows: list[dict[str, Any]]) -> list[str]:
    lines = ["| Encoded feature | Coefficient |", "| --- | ---: |"]
    lines.extend(f"| `{row['feature']}` | {row['coefficient']:+.3f} |" for row in rows)
    return lines


def render_markdown(report: dict[str, Any]) -> str:
    selected = report["selected_threshold_metrics"]
    slice_rows = report["error_slices"]
    highest_fp = sorted(
        (row for row in slice_rows if row["false_positive_rate"] is not None),
        key=lambda row: row["false_positive_rate"],
        reverse=True,
    )[:6]
    highest_fn = sorted(
        (row for row in slice_rows if row["false_negative_rate"] is not None),
        key=lambda row: row["false_negative_rate"],
        reverse=True,
    )[:6]

    lines = [
        "# CreditWise model diagnostics",
        "",
        "This report is generated by `python -m creditwise.diagnostics` from the frozen model artifact and fixed test split. It describes the current course-project model; it does not validate real lending use.",
        "",
        "## Frozen evaluation context",
        "",
        f"- Model version: `{report['model_version']}`",
        f"- Dataset SHA-256: `{report['dataset_sha256']}`",
        f"- Split seed: `{report['split_seed']}`",
        f"- Test rows: {report['test_rows']:,}",
        f"- Validation-selected threshold: {report['selected_threshold']:.3f}",
        f"- Test confusion matrix: TN {selected['confusion']['tn']}, FP {selected['confusion']['fp']}, FN {selected['confusion']['fn']}, TP {selected['confusion']['tp']}",
        "",
        "## Threshold tradeoffs",
        "",
        "The selected threshold maximizes F1 on validation data. The alternatives below are evaluated on the fixed test split only to explain behavior; they are not a new threshold search.",
        "",
        "| Threshold | Precision | Recall | F1 | Balanced accuracy | False positives | False negatives |",
        "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in report["threshold_tradeoffs"]:
        lines.append(
            f"| {row['threshold']:.3f} | {_percent(row['precision'])} | {_percent(row['recall'])} | {_percent(row['f1'])} | {_percent(row['balanced_accuracy'])} | {row['confusion']['fp']} | {row['confusion']['fn']} |"
        )

    lines.extend(
        [
            "",
            "Lower thresholds recover more positive labels but increase false positives. Higher thresholds improve precision while missing more positive labels. A real decision policy would need explicit error costs rather than F1 alone.",
            "",
            "## Calibration check",
            "",
            "The model emits an uncalibrated score. Equal-frequency test bins show how each score band compares with its observed positive rate.",
            "",
            "| Score range | Rows | Mean score | Observed positive rate | Absolute gap |",
            "| --- | ---: | ---: | ---: | ---: |",
        ]
    )
    for row in report["calibration_bins"]:
        lines.append(
            f"| {row['range']} | {row['rows']} | {_percent(row['mean_score'])} | {_percent(row['observed_rate'])} | {_percent(row['absolute_gap'])} |"
        )
    lines.extend(
        [
            "",
            f"The equal-frequency expected calibration error is {_percent(report['expected_calibration_error'])}. This descriptive value confirms that the score should not be presented as a probability of repayment or approval.",
            "",
            "## Coefficient inspection",
            "",
            "Numeric inputs are median-imputed and standardized; categories are one-hot encoded. Coefficients show associations in the fitted linear decision function, not causal effects. Correlated inputs and class weighting also limit standalone interpretation.",
            "",
            "### Largest positive coefficients",
            "",
            *_coefficient_table(report["coefficients"]["positive"]),
            "",
            "### Largest negative coefficients",
            "",
            *_coefficient_table(report["coefficients"]["negative"]),
            "",
            "## Error slices",
            "",
            "The tables rank descriptive test-set slices with at least 50 rows. They identify places to investigate; they do not establish fairness or generalization because the dataset provenance and real population are unknown.",
            "",
            "### Highest false-positive rates",
            "",
            "| Feature | Group | Rows | Negative rows | False-positive rate |",
            "| --- | --- | ---: | ---: | ---: |",
        ]
    )
    for row in highest_fp:
        lines.append(
            f"| {row['feature']} | {row['group']} | {row['rows']} | {row['negative_rows']} | {_percent(row['false_positive_rate'])} |"
        )
    lines.extend(
        [
            "",
            "### Highest false-negative rates",
            "",
            "| Feature | Group | Rows | Positive rows | False-negative rate |",
            "| --- | --- | ---: | ---: | ---: |",
        ]
    )
    for row in highest_fn:
        lines.append(
            f"| {row['feature']} | {row['group']} | {row['rows']} | {row['positive_rows']} | {_percent(row['false_negative_rate'])} |"
        )
    lines.extend(
        [
            "",
            "## Limitations",
            "",
            "- Test diagnostics reuse the held-out labels for interpretation after the model and threshold were frozen; they must not be used to tune another version and still call this the untouched test result.",
            "- The target is a historical or synthetic approval label, not repayment, default, or borrower welfare.",
            "- Dataset provenance, sampling, collection dates, currency, consent, and deployment population are not documented.",
            "- Excluding age, gender, and marital status does not prove fairness because other inputs can act as proxies.",
            "- Coefficients depend on preprocessing, regularization, class weighting, and correlations; they are not causal explanations.",
            "- Calibration and error rates may shift outside this fixed dataset.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate CreditWise model diagnostics.")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA_PATH)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON_PATH)
    parser.add_argument("--markdown", type=Path, default=DEFAULT_MARKDOWN_PATH)
    args = parser.parse_args()
    if not args.model.exists():
        raise FileNotFoundError("Model artifact unavailable; run `python -m creditwise.training` first.")
    report = build_diagnostics(args.data, args.model)
    args.json.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    args.markdown.write_text(render_markdown(report), encoding="utf-8")
    print(json.dumps({"json": str(args.json), "markdown": str(args.markdown)}, indent=2))


if __name__ == "__main__":
    main()

