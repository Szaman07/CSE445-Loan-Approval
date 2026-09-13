from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_trained_model_serves_a_versioned_prediction() -> None:
    applicant = {
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

    response = client.post("/api/predict", json=applicant)

    assert response.status_code == 200
    payload = response.json()
    assert 0 <= payload["model_score"] <= 1
    assert payload["predicted_label"] in {"Approved", "Not approved"}
    assert payload["model_version"] == "0.1.0"
    assert payload["score_type"] == "uncalibrated model score"
