import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


@pytest.fixture
def applicant() -> dict:
    return {
        "Applicant_Income": 11500,
        "Coapplicant_Income": 4200,
        "Employment_Status": "Salaried",
        "Age": 38,
        "Marital_Status": "Married",
        "Dependents": 1,
        "Credit_Score": 715,
        "Existing_Loans": 1,
        "DTI_Ratio": 0.28,
        "Savings": 12000,
        "Collateral_Value": 26000,
        "Loan_Amount": 19000,
        "Loan_Term": 48,
        "Loan_Purpose": "Home",
        "Property_Area": "Urban",
        "Education_Level": "Graduate",
        "Gender": "Female",
        "Employer_Category": "Private",
    }



def test_trained_model_serves_a_versioned_prediction(applicant) -> None:
    response = client.post("/api/predict", json=applicant)

    assert response.status_code == 200
    payload = response.json()
    assert 0 <= payload["model_score"] <= 1
    assert payload["predicted_label"] in {"Approved", "Not approved"}
    assert payload["model_version"] == "0.1.0"
    assert payload["score_type"] == "uncalibrated model score"


@pytest.mark.parametrize("field,value", [
    ("Employment_Status", "invented"), ("Dependents", 1.5), ("Loan_Term", 12.5),
    ("Existing_Loans", 0.25), ("Gender", "invalid"),
])
def test_invalid_input_values_are_rejected(applicant, field, value) -> None:
    applicant[field] = value
    assert client.post("/api/predict", json=applicant).status_code == 422


def test_nonfinite_input_returns_validation_error(applicant) -> None:
    import json

    body = json.dumps(applicant).replace('"Applicant_Income": 11500', '"Applicant_Income": 1e309')
    response = client.post("/api/predict", content=body, headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"][-1] == "Applicant_Income"


def test_missing_optional_values_are_imputed_and_audit_fields_are_ignored(applicant) -> None:
    applicant.update(Coapplicant_Income=None, Dependents=None, Loan_Term=None, Savings=None)
    scenario = {**applicant, "Age": 70, "Gender": "Male", "Marital_Status": "Single"}
    response = client.post("/api/compare", json={"baseline": applicant, "scenario": scenario})
    assert response.status_code == 200
    payload = response.json()
    assert payload["changed_fields"] == []
    assert payload["score_change"] == 0
    assert len(payload["baseline"]["input_notes"]) == 4
