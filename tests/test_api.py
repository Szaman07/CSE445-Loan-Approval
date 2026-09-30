import pytest
from fastapi.testclient import TestClient

from api.main import app
from creditwise import inference

client = TestClient(app)


def test_health_is_truthful() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ok", "degraded"}
    assert payload["model_ready"] == (payload["status"] == "ok")


def test_invalid_prediction_is_rejected() -> None:
    response = client.post("/api/predict", json={"Applicant_Income": -1})
    assert response.status_code == 422


def test_explorer_schema_exposes_model_and_audit_roles() -> None:
    response = client.get("/api/dataset/schema")
    assert response.status_code == 200
    payload = response.json()
    features = {item["feature"]: item for item in payload["features"]}
    assert payload["profile"]["rows"] == 10_000
    assert features["Education_Level"]["used_by_model"] is True
    assert features["Age"]["used_by_model"] is False
    assert features["Loan_to_Income"]["derived"] is True


def test_distribution_and_group_denominators_are_consistent() -> None:
    distribution = client.get("/api/dataset/distribution", params={"feature": "Credit_Score"})
    assert distribution.status_code == 200
    payload = distribution.json()
    assert sum(row["all"] for row in payload["series"]) == payload["valid"]

    groups = client.get("/api/dataset/groups", params={"feature": "Loan_Purpose"})
    assert groups.status_code == 200
    assert sum(group["total"] for group in groups.json()["groups"]) + groups.json()["missing"] == groups.json()["total"]
    for group in groups.json()["groups"]:
        assert group["labeled"] == group["approved"] + group["not_approved"]
        assert group["total"] == group["labeled"] + group["unknown"]


def test_relationship_is_deterministically_sampled_and_filterable() -> None:
    params = {"x": "Total_Income", "y": "Loan_Amount", "filter_feature": "Property_Area", "filter_value": "Urban"}
    first = client.get("/api/dataset/relationship", params=params)
    second = client.get("/api/dataset/relationship", params=params)
    assert first.status_code == 200
    assert first.json()["points"] == second.json()["points"]
    assert first.json()["shown_count"] <= 600


def test_preview_redacts_source_identifier() -> None:
    response = client.get("/api/dataset/preview", params={"limit": 2})
    assert response.status_code == 200
    payload = response.json()
    assert payload["rows"][0]["record"] == "Record 0001"
    assert "Applicant_ID" not in payload["columns"]


def test_preview_preserves_unknown_target() -> None:
    response = client.get("/api/dataset/preview", params={"offset": 15, "limit": 1})
    assert response.status_code == 200
    assert response.json()["rows"][0]["Loan_Approved"] == "Unknown"


def test_relationship_can_use_the_same_feature_on_both_axes() -> None:
    response = client.get("/api/dataset/relationship", params={"x": "Credit_Score", "y": "Credit_Score"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["correlation"] == 1
    assert all(point["x"] == point["y"] for point in payload["points"])


@pytest.mark.parametrize("artifact", [None, b"not a joblib model"])
def test_missing_or_corrupt_model_returns_service_unavailable(tmp_path, monkeypatch, artifact) -> None:
    path = tmp_path / "model.joblib"
    if artifact is not None:
        path.write_bytes(artifact)
    monkeypatch.setattr(inference, "DEFAULT_MODEL_PATH", path)
    for endpoint in ("/api/health", "/api/metadata"):
        response = client.get(endpoint)
        assert response.status_code == 503
    assert client.get("/api/health").json()["model_ready"] is False
    applicant = {
        "Applicant_Income": 1000, "Employment_Status": "Salaried", "Credit_Score": 700,
        "DTI_Ratio": 0.3, "Loan_Amount": 1000, "Loan_Purpose": "Home",
        "Property_Area": "Urban", "Education_Level": "Graduate", "Employer_Category": "Private",
    }
    assert client.post("/api/predict", json=applicant).status_code == 503
    assert client.post("/api/compare", json={"baseline": applicant, "scenario": applicant}).status_code == 503
    # Exploration is still usable when the model is unavailable.
    assert client.get("/api/dataset/schema").status_code == 200
