import type { Applicant } from './types'

export const exampleApplicant: Applicant = {
  Applicant_Income: 11500,
  Coapplicant_Income: 4200,
  Employment_Status: 'Salaried',
  Dependents: 1,
  Credit_Score: 715,
  Existing_Loans: 1,
  DTI_Ratio: 0.28,
  Savings: 12000,
  Collateral_Value: 26000,
  Loan_Amount: 19000,
  Loan_Term: 48,
  Loan_Purpose: 'Home',
  Property_Area: 'Urban',
  Education_Level: 'Graduate',
  Employer_Category: 'Private',
  Age: null,
  Marital_Status: null,
  Gender: null,
}

export const numericFeatures = [
  'Applicant_Income', 'Coapplicant_Income', 'Age', 'Dependents', 'Credit_Score', 'Existing_Loans', 'DTI_Ratio', 'Savings',
  'Collateral_Value', 'Loan_Amount', 'Loan_Term', 'Total_Income', 'Loan_to_Income', 'Savings_to_Loan', 'Collateral_to_Loan',
]
export const categoricalFeatures = ['Employment_Status', 'Marital_Status', 'Loan_Purpose', 'Property_Area', 'Education_Level', 'Gender', 'Employer_Category']
export const pretty = (value: string) => value.replaceAll('_', ' ')
export const pct = (value: number | undefined | null, digits = 1) => value == null ? '—' : `${(value * 100).toFixed(digits)}%`
export const number = (value: number | undefined | null, digits = 0) => value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: digits })
