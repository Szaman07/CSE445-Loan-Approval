from __future__ import annotations

import argparse
import json
import platform
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split

from creditwise.data import MODEL_FEATURES, PUBLIC_MODEL_FEATURES, labeled_xy, load_dataset
from creditwise.modeling import (
    ModelSpec,
    build_logistic_pipeline,
    select_threshold,
    threshold_metrics,
)
from creditwise.settings import (
    DEFAULT_DATA_PATH,
    DEFAULT_METADATA_PATH,
    DEFAULT_MODEL_PATH,
    MANIFEST_DIR,
    RANDOM_SEED,
)


@dataclass(frozen=True)
class CandidateResult:
    name: str
    cv_f1_mean: float
    cv_f1_std: float
    cv_average_precision_mean: float
    cv_recall_mean: float
    cv_precision_mean: float


def candidate_specs() -> list[ModelSpec]:
    specs: list[ModelSpec] = []
    for public_policy in (False, True):
        policy = "public" if public_policy else "full"
        for engineered in (False, True):
            feature_label = "engineered" if engineered else "raw"
            for penalty in ("l1", "l2"):
                for c_value in (0.03, 0.1, 0.3, 1.0, 3.0):
                    specs.append(
                        ModelSpec(
                            name=f"logistic_{penalty}_{policy}_{feature_label}_c{c_value:g}",
                            penalty=penalty,
                            c=c_value,
                            class_weight="balanced",
                            public_policy=public_policy,
                            engineered=engineered,
                        )
                    )
    return specs


def evaluate_candidate(spec: ModelSpec, X_train: pd.DataFrame, y_train: pd.Series) -> CandidateResult:
    feature_order = PUBLIC_MODEL_FEATURES if spec.public_policy else MODEL_FEATURES
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
    scores = cross_validate(
        build_logistic_pipeline(spec),
        X_train[feature_order],
        y_train,
        cv=cv,
        scoring={
            "f1": "f1",
            "average_precision": "average_precision",
            "recall": "recall",
            "precision": "precision",
        },
        n_jobs=-1,
        error_score="raise",
    )
    return CandidateResult(
        name=spec.name,
        cv_f1_mean=float(scores["test_f1"].mean()),
        cv_f1_std=float(scores["test_f1"].std()),
        cv_average_precision_mean=float(scores["test_average_precision"].mean()),
        cv_recall_mean=float(scores["test_recall"].mean()),
        cv_precision_mean=float(scores["test_precision"].mean()),
    )


def split_data(X: pd.DataFrame, y: pd.Series) -> tuple[pd.DataFrame, ...]:
    indices = np.arange(len(y))
    development_idx, test_idx = train_test_split(
        indices, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )
    train_idx, validation_idx = train_test_split(
        development_idx,
        test_size=0.25,
        random_state=RANDOM_SEED,
        stratify=y.iloc[development_idx],
    )
    return (
        X.iloc[train_idx].copy(),
        X.iloc[validation_idx].copy(),
        X.iloc[test_idx].copy(),
        y.iloc[train_idx].copy(),
        y.iloc[validation_idx].copy(),
        y.iloc[test_idx].copy(),
        train_idx,
        validation_idx,
        test_idx,
    )


def train(data_path: Path, model_path: Path, metadata_path: Path) -> dict[str, object]:
    frame, profile = load_dataset(data_path)
    X, y = labeled_xy(frame)
    (
        X_train,
        X_validation,
        X_test,
        y_train,
        y_validation,
        y_test,
        train_idx,
        validation_idx,
        test_idx,
    ) = split_data(X, y)

    specs = candidate_specs()
    results = [evaluate_candidate(spec, X_train, y_train) for spec in specs]
    ranked = sorted(
        results,
        key=lambda result: (result.cv_f1_mean, result.cv_average_precision_mean),
        reverse=True,
    )
    finalist_names = {result.name for result in ranked[:3]}
    finalists: list[dict[str, object]] = []
    fitted: dict[str, object] = {}

    for spec in specs:
        if spec.name not in finalist_names:
            continue
        feature_order = PUBLIC_MODEL_FEATURES if spec.public_policy else MODEL_FEATURES
        model = build_logistic_pipeline(spec)
        model.fit(X_train[feature_order], y_train)
        validation_probabilities = model.predict_proba(X_validation[feature_order])[:, 1]
        threshold, validation_metrics = select_threshold(y_validation, validation_probabilities)
        finalists.append(
            {
                "spec": asdict(spec),
                "threshold": threshold,
                "validation": validation_metrics,
            }
        )
        fitted[spec.name] = model

    winner = max(
        finalists,
        key=lambda item: (
            item["validation"]["f1"],
            item["validation"]["average_precision"],
            -abs(item["threshold"] - 0.5),
        ),
    )
    winning_spec = ModelSpec(**winner["spec"])
    winning_features = PUBLIC_MODEL_FEATURES if winning_spec.public_policy else MODEL_FEATURES
    model = fitted[winning_spec.name]
    test_probabilities = model.predict_proba(X_test[winning_features])[:, 1]
    test_metrics = threshold_metrics(y_test, test_probabilities, winner["threshold"])

    created_at = datetime.now(UTC).isoformat()
    metadata: dict[str, object] = {
        "model_version": "0.1.0",
        "created_at": created_at,
        "dataset": profile.as_dict(),
        "split": {
            "seed": RANDOM_SEED,
            "train_rows": len(train_idx),
            "validation_rows": len(validation_idx),
            "test_rows": len(test_idx),
        },
        "winner": winner,
        "test": test_metrics,
        "candidate_ranking": [asdict(result) for result in ranked],
        "feature_order": winning_features,
        "score_type": "uncalibrated model score",
        "environment": {
            "python": sys.version,
            "platform": platform.platform(),
            "pandas": pd.__version__,
            "scikit_learn": sklearn.__version__,
        },
        "limitations": [
            "Predicts historical approval labels, not repayment or default.",
            "Dataset provenance, currency, income period, and license require confirmation.",
            "The dataset was explored before this evaluation; test results are controlled, not external validation.",
        ],
    }

    bundle = {
        "pipeline": model,
        "threshold": winner["threshold"],
        "feature_order": winning_features,
        "metadata": metadata,
    }
    model_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, model_path)
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (MANIFEST_DIR / "split_manifest.json").write_text(
        json.dumps(
            {
                "dataset_sha256": profile.sha256,
                "seed": RANDOM_SEED,
                "train_indices": train_idx.tolist(),
                "validation_indices": validation_idx.tolist(),
                "test_indices": test_idx.tolist(),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and evaluate the CreditWise model.")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA_PATH)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--metadata", type=Path, default=DEFAULT_METADATA_PATH)
    args = parser.parse_args()
    metadata = train(args.data, args.model, args.metadata)
    print(json.dumps({"winner": metadata["winner"], "test": metadata["test"]}, indent=2))


if __name__ == "__main__":
    main()
