from __future__ import annotations

import json
import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from creditwise.data import load_dataset
from creditwise.exploration import (
    apply_cohort,
    distribution_payload,
    explorer_frame,
    groups_payload,
    preview_payload,
    relationship_payload,
    schema_payload,
)
from creditwise.inference import compare, load_bundle, predict
from creditwise.schemas import (
    ApplicantInput,
    ComparisonRequest,
    ComparisonResponse,
    PredictionResponse,
)
from creditwise.settings import DEFAULT_DATA_PATH, DEFAULT_METADATA_PATH

app = FastAPI(
    title="CreditWise API",
    version="0.2.0",
    description="Reproducible exploration and inference for a loan-approval label classifier.",
)
configured_origins = [
    origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", *configured_origins],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, object]:
    model_ready = True
    detail = "ready"
    try:
        load_bundle()
    except (FileNotFoundError, OSError, ValueError, EOFError) as error:
        model_ready = False
        detail = str(error)
    return {
        "status": "ok" if model_ready else "degraded",
        "model_ready": model_ready,
        "detail": detail,
    }


@app.get("/api/metadata")
def metadata() -> dict[str, object]:
    if not DEFAULT_METADATA_PATH.exists():
        raise HTTPException(status_code=503, detail="Model metadata is unavailable.")
    return json.loads(DEFAULT_METADATA_PATH.read_text(encoding="utf-8"))


@app.get("/api/dataset/summary")
def dataset_summary() -> dict[str, object]:
    frame, profile = load_dataset(DEFAULT_DATA_PATH)
    missing = frame.isna().sum().sort_values(ascending=False)
    labeled = frame[frame["Loan_Approved"].notna()].copy()
    labels = [
        {"label": "Not approved", "count": profile.negative_rows},
        {"label": "Approved", "count": profile.positive_rows},
        {"label": "Unknown", "count": profile.missing_targets},
    ]
    credit_by_outcome = []
    for value, label in ((0, "Not approved"), (1, "Approved")):
        values = labeled.loc[labeled["Loan_Approved"] == value, "Credit_Score"].dropna()
        credit_by_outcome.append(
            {
                "label": label,
                "mean": round(float(values.mean()), 2),
                "median": round(float(values.median()), 2),
                "count": int(values.size),
            }
        )
    return {
        "profile": profile.as_dict(),
        "labels": labels,
        "missingness": [
            {"feature": feature, "missing": int(value), "rate": float(value / len(frame))}
            for feature, value in missing.items()
        ],
        "credit_by_outcome": credit_by_outcome,
    }


@app.get("/api/dataset/schema")
def dataset_schema() -> dict[str, object]:
    frame, profile = load_dataset(DEFAULT_DATA_PATH)
    explored = explorer_frame(frame)
    return {"profile": profile.as_dict(), "features": schema_payload(explored)}


@app.get("/api/dataset/preview")
def dataset_preview(
    offset: int = Query(default=0, ge=0), limit: int = Query(default=15, ge=1, le=50)
) -> dict[str, object]:
    frame, _ = load_dataset(DEFAULT_DATA_PATH)
    return preview_payload(frame, offset=offset, limit=limit)


@app.get("/api/dataset/distribution")
def dataset_distribution(
    feature: str = "Credit_Score",
    bins: int = Query(default=14, ge=5, le=30),
    filter_feature: str | None = None,
    filter_value: str | None = None,
) -> dict[str, object]:
    frame, _ = load_dataset(DEFAULT_DATA_PATH)
    explored = apply_cohort(explorer_frame(frame), filter_feature, filter_value)
    return distribution_payload(explored, feature, bins)


@app.get("/api/dataset/relationship")
def dataset_relationship(
    x: str = "Credit_Score",
    y: str = "DTI_Ratio",
    limit: int = Query(default=600, ge=100, le=1500),
    filter_feature: str | None = None,
    filter_value: str | None = None,
) -> dict[str, object]:
    frame, _ = load_dataset(DEFAULT_DATA_PATH)
    explored = apply_cohort(explorer_frame(frame), filter_feature, filter_value)
    return relationship_payload(explored, x, y, limit)


@app.get("/api/dataset/groups")
def dataset_groups(
    feature: str = "Loan_Purpose",
    filter_feature: str | None = None,
    filter_value: str | None = None,
) -> dict[str, object]:
    frame, _ = load_dataset(DEFAULT_DATA_PATH)
    explored = apply_cohort(explorer_frame(frame), filter_feature, filter_value)
    return groups_payload(explored, feature)


@app.post("/api/predict", response_model=PredictionResponse)
def predict_endpoint(applicant: ApplicantInput) -> PredictionResponse:
    try:
        return predict(applicant)
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.post("/api/compare", response_model=ComparisonResponse)
def compare_endpoint(request: ComparisonRequest) -> ComparisonResponse:
    try:
        return compare(request.baseline, request.scenario)
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
