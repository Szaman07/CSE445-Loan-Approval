import numpy as np
import pandas as pd

from creditwise.features import FinancialFeatureEngineer


def test_engineered_features_use_raw_financial_meanings() -> None:
    source = pd.DataFrame(
        [{
            "Applicant_Income": 5000,
            "Coapplicant_Income": 1000,
            "Loan_Amount": 12000,
            "Savings": 3000,
            "Collateral_Value": 18000,
            "Dependents": 2,
            "Credit_Score": 700,
            "DTI_Ratio": 0.3,
        }]
    )
    result = FinancialFeatureEngineer().fit_transform(source)

    assert result.loc[0, "Total_Income"] == 6000
    assert result.loc[0, "Loan_to_Income"] == 2
    assert result.loc[0, "Income_per_Household_Member_Proxy"] == 2000
    assert np.isclose(result.loc[0, "Credit_x_Repayment_Capacity"], 490)
    assert np.isclose(result.loc[0, "Savings_to_Loan"], 0.25)
