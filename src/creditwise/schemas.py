from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ApplicantInput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    Applicant_Income: float = Field(ge=0, le=1_000_000)
    Coapplicant_Income: float | None = Field(default=None, ge=0, le=1_000_000)
    Employment_Status: Literal["Salaried", "Contract", "Self-employed", "Unemployed"]
    Age: float | None = Field(default=None, ge=18, le=100)
    Marital_Status: Literal["Married", "Single"] | None = None
    Dependents: int | None = Field(default=None, ge=0, le=20)
    Credit_Score: float = Field(ge=300, le=850)
    Existing_Loans: int | None = Field(default=None, ge=0, le=50)
    DTI_Ratio: float = Field(ge=0, le=1)
    Savings: float | None = Field(default=None, ge=0, le=10_000_000)
    Collateral_Value: float | None = Field(default=None, ge=0, le=100_000_000)
    Loan_Amount: float = Field(gt=0, le=100_000_000)
    Loan_Term: int | None = Field(default=None, gt=0, le=600)
    Loan_Purpose: Literal["Business", "Car", "Education", "Home", "Personal"]
    Property_Area: Literal["Rural", "Semiurban", "Urban"]
    Education_Level: Literal["Graduate", "Not Graduate"]
    Gender: Literal["Female", "Male"] | None = None
    Employer_Category: Literal["Business", "Government", "MNC", "Private", "Unemployed"]


class PredictionResponse(BaseModel):
    model_score: float
    predicted_label: str
    threshold: float
    model_version: str
    score_type: str
    input_notes: list[str]


class ComparisonRequest(BaseModel):
    baseline: ApplicantInput
    scenario: ApplicantInput


class ComparisonResponse(BaseModel):
    baseline: PredictionResponse
    scenario: PredictionResponse
    score_change: float
    threshold_crossed: bool
    changed_fields: list[str]
