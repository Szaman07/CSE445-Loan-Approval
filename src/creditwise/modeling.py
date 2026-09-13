from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from creditwise.data import CATEGORICAL_FEATURES, NUMERIC_FEATURES, PUBLIC_MODEL_FEATURES
from creditwise.features import FinancialFeatureEngineer

ENGINEERED_NUMERIC = [
    "Total_Income",
    "Log_Applicant_Income",
    "Log_Coapplicant_Income",
    "Log_Loan_Amount",
    "Loan_to_Income",
    "Savings_to_Loan",
    "Collateral_to_Loan",
    "Income_per_Household_Member_Proxy",
    "Credit_x_Repayment_Capacity",
    "Credit_x_DTI",
]


@dataclass(frozen=True)
class ModelSpec:
    name: str
    penalty: str = "l1"
    c: float = 0.35
    class_weight: str | dict[int, float] | None = "balanced"
    public_policy: bool = False
    engineered: bool = True


def build_logistic_pipeline(spec: ModelSpec) -> Pipeline:
    raw_features = PUBLIC_MODEL_FEATURES if spec.public_policy else NUMERIC_FEATURES + CATEGORICAL_FEATURES
    numeric = [feature for feature in NUMERIC_FEATURES if feature in raw_features]
    categorical = [feature for feature in CATEGORICAL_FEATURES if feature in raw_features]
    if spec.engineered:
        numeric += ENGINEERED_NUMERIC

    preprocessor = ColumnTransformer(
        [
            (
                "numeric",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
                        ("scaler", StandardScaler()),
                    ]
                ),
                numeric,
            ),
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical,
            ),
        ],
        verbose_feature_names_out=False,
    )

    solver = "liblinear" if spec.penalty == "l1" else "lbfgs"
    classifier = LogisticRegression(
        C=spec.c,
        l1_ratio=1.0 if spec.penalty == "l1" else 0.0,
        solver=solver,
        class_weight=spec.class_weight,
        max_iter=5000,
        random_state=42,
    )
    steps: list[tuple[str, object]] = []
    if spec.engineered:
        steps.append(("features", FinancialFeatureEngineer()))
    steps.extend([("preprocessor", preprocessor), ("classifier", classifier)])
    return Pipeline(steps)


def threshold_metrics(y_true: pd.Series | np.ndarray, probabilities: np.ndarray, threshold: float) -> dict[str, object]:
    predictions = (probabilities >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, predictions, labels=[0, 1]).ravel()
    return {
        "threshold": float(threshold),
        "f1": float(f1_score(y_true, predictions, zero_division=0)),
        "precision": float(precision_score(y_true, predictions, zero_division=0)),
        "recall": float(recall_score(y_true, predictions, zero_division=0)),
        "accuracy": float(accuracy_score(y_true, predictions)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, predictions)),
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "average_precision": float(average_precision_score(y_true, probabilities)),
        "brier": float(brier_score_loss(y_true, probabilities)),
        "log_loss": float(log_loss(y_true, probabilities)),
        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def select_threshold(y_true: pd.Series, probabilities: np.ndarray) -> tuple[float, dict[str, object]]:
    candidates = np.linspace(0.05, 0.95, 901)
    scores = np.asarray([f1_score(y_true, probabilities >= t) for t in candidates])
    best = scores.max()
    tied = np.flatnonzero(np.isclose(scores, best, atol=1e-12))
    index = tied[np.argmin(np.abs(candidates[tied] - 0.5))]
    threshold = float(candidates[index])
    return threshold, threshold_metrics(y_true, probabilities, threshold)
