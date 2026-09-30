from __future__ import annotations

from functools import lru_cache

import joblib
import numpy as np
import pandas as pd
from sklearn.utils.validation import check_is_fitted

from creditwise.data import PUBLIC_MODEL_FEATURES
from creditwise.schemas import ApplicantInput, ComparisonResponse, PredictionResponse
from creditwise.settings import DEFAULT_MODEL_PATH


class ModelUnavailableError(RuntimeError):
    """A missing, corrupt, or incompatible model cannot serve predictions."""


def load_bundle() -> dict[str, object]:
    try:
        stat = DEFAULT_MODEL_PATH.stat()
        return _load_bundle(str(DEFAULT_MODEL_PATH), stat.st_mtime_ns, stat.st_size)
    except ModelUnavailableError:
        raise
    except (OSError, ValueError) as error:
        raise ModelUnavailableError("Model unavailable. Run the training command first.") from error


@lru_cache(maxsize=1)
def _load_bundle(path: str, modified: int, size: int) -> dict[str, object]:
    try:
        bundle = joblib.load(path)
        _validate_bundle(bundle)
    except Exception as error:
        raise ModelUnavailableError("Model artifact is invalid. Run the training command again.") from error
    return bundle


def _validate_bundle(bundle: object) -> None:
    required = {"pipeline", "threshold", "feature_order", "metadata"}
    if not isinstance(bundle, dict) or required - bundle.keys():
        raise ValueError("Model bundle is incomplete")
    if bundle["feature_order"] != PUBLIC_MODEL_FEATURES:
        raise ValueError("Model features do not match the public input contract")
    if not callable(getattr(bundle["pipeline"], "predict_proba", None)):
        raise TypeError("Model pipeline cannot score inputs")
    check_is_fitted(bundle["pipeline"])
    if list(bundle["pipeline"].feature_names_in_) != bundle["feature_order"]:
        raise ValueError("Model feature order does not match the fitted pipeline")
    threshold = float(bundle["threshold"])
    metadata = bundle["metadata"]
    if not np.isfinite(threshold) or not 0 <= threshold <= 1:
        raise ValueError("Invalid decision threshold")
    metadata_fields = {
        "model_version", "score_type", "winner", "test", "dataset", "split",
        "candidate_ranking", "created_at", "limitations", "feature_order",
    }
    if not isinstance(metadata, dict) or not metadata_fields.issubset(metadata):
        raise ValueError("Model metadata is incomplete")
    if metadata["winner"]["threshold"] != threshold or metadata["feature_order"] != bundle["feature_order"]:
        raise ValueError("Model metadata does not match the pipeline")


def predict(applicant: ApplicantInput) -> PredictionResponse:
    return _predict(applicant, load_bundle())


def _predict(applicant: ApplicantInput, bundle: dict[str, object]) -> PredictionResponse:
    values = applicant.model_dump()
    feature_order = bundle["feature_order"]
    frame = pd.DataFrame([{feature: values.get(feature) for feature in feature_order}]).replace(
        {None: np.nan}
    )
    score = float(bundle["pipeline"].predict_proba(frame)[:, 1][0])
    threshold = float(bundle["threshold"])
    missing = [feature for feature in feature_order if values.get(feature) is None]
    return PredictionResponse(
        model_score=score,
        predicted_label="Approved" if score >= threshold else "Not approved",
        threshold=threshold,
        model_version=bundle["metadata"]["model_version"],
        score_type=bundle["metadata"]["score_type"],
        input_notes=[f"Model handled missing value: {feature}" for feature in missing],
    )


def compare(baseline: ApplicantInput, scenario: ApplicantInput) -> ComparisonResponse:
    bundle = load_bundle()
    baseline_result = _predict(baseline, bundle)
    scenario_result = _predict(scenario, bundle)
    baseline_data = baseline.model_dump()
    scenario_data = scenario.model_dump()
    changed = sorted(
        field for field in bundle["feature_order"]
        if baseline_data[field] != scenario_data[field]
    )
    return ComparisonResponse(
        baseline=baseline_result,
        scenario=scenario_result,
        score_change=scenario_result.model_score - baseline_result.model_score,
        threshold_crossed=baseline_result.predicted_label != scenario_result.predicted_label,
        changed_fields=changed,
    )
