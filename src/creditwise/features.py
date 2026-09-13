from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin


class FinancialFeatureEngineer(BaseEstimator, TransformerMixin):
    """Add deterministic, named financial features without fitting on held-out data."""

    def fit(self, X: pd.DataFrame, y: pd.Series | None = None) -> FinancialFeatureEngineer:
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        frame = X.copy()
        applicant = pd.to_numeric(frame.get("Applicant_Income"), errors="coerce")
        coapplicant = pd.to_numeric(frame.get("Coapplicant_Income"), errors="coerce")
        loan = pd.to_numeric(frame.get("Loan_Amount"), errors="coerce")
        savings = pd.to_numeric(frame.get("Savings"), errors="coerce")
        collateral = pd.to_numeric(frame.get("Collateral_Value"), errors="coerce")
        dependents = pd.to_numeric(frame.get("Dependents"), errors="coerce")
        credit = pd.to_numeric(frame.get("Credit_Score"), errors="coerce")
        dti = pd.to_numeric(frame.get("DTI_Ratio"), errors="coerce")

        total_income = applicant + coapplicant
        safe_total = total_income.where(total_income > 0)
        safe_loan = loan.where(loan > 0)

        frame["Total_Income"] = total_income
        frame["Log_Applicant_Income"] = np.log1p(applicant.clip(lower=0))
        frame["Log_Coapplicant_Income"] = np.log1p(coapplicant.clip(lower=0))
        frame["Log_Loan_Amount"] = np.log1p(loan.clip(lower=0))
        frame["Loan_to_Income"] = loan / safe_total
        frame["Savings_to_Loan"] = savings / safe_loan
        frame["Collateral_to_Loan"] = collateral / safe_loan
        frame["Income_per_Household_Member_Proxy"] = total_income / (dependents + 1)
        frame["Credit_x_Repayment_Capacity"] = credit * (1 - dti)
        frame["Credit_x_DTI"] = credit * dti
        return frame.replace([np.inf, -np.inf], np.nan)
