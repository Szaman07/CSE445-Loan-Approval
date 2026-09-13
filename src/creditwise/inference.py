from __future__ import annotations

from functools import lru_cache

import joblib
import pandas as pd

from creditwise.schemas import ApplicantInput, ComparisonResponse, PredictionResponse
from creditwise.settings import DEFAULT_MODEL_PATH


@lru_cache(maxsize=1)
def load_bundle() -> dict[str, object]:
    if not DEFAULT_MODEL_PATH.exists():
        raise FileNotFoundError(
            "Model artifact is unavailable. Run `python -m creditwise.training` first."
        )
    bundle = joblib.load(DEFAULT_MODEL_PATH)
    required = {"pipeline", "threshold", "feature_order", "metadata"}
    missing = required - set(bundle)
    if missing:
        raise ValueError(f"Model bundle is missing: {sorted(missing)}")
    return bundle


def predict(applicant: ApplicantInput) -> PredictionResponse:
    bundle = load_bundle()
    values = applicant.model_dump()
    feature_order = bundle["feature_order"]
    frame = pd.DataFrame([{feature: values.get(feature) for feature in feature_order}])
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
    baseline_result = predict(baseline)
    scenario_result = predict(scenario)
    baseline_data = baseline.model_dump()
    scenario_data = scenario.model_dump()
    changed = sorted(
        field for field in baseline_data if baseline_data[field] != scenario_data[field]
    )
    return ComparisonResponse(
        baseline=baseline_result,
        scenario=scenario_result,
        score_change=scenario_result.model_score - baseline_result.model_score,
        threshold_crossed=baseline_result.predicted_label != scenario_result.predicted_label,
        changed_fields=changed,
    )
