from fastapi.testclient import TestClient

from api.main import app

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
