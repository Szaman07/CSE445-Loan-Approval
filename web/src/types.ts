export type RouteId = 'overview' | 'explore' | 'simulator' | 'model' | 'about'

export type Applicant = {
  Applicant_Income: number
  Coapplicant_Income: number | null
  Employment_Status: string
  Dependents: number | null
  Credit_Score: number
  Existing_Loans: number | null
  DTI_Ratio: number
  Savings: number | null
  Collateral_Value: number | null
  Loan_Amount: number
  Loan_Term: number | null
  Loan_Purpose: string
  Property_Area: string
  Education_Level: string
  Employer_Category: string
  Age?: null
  Marital_Status?: null
  Gender?: null
}

export type Prediction = { model_score: number; predicted_label: string; threshold: number; model_version: string; score_type: string; input_notes: string[] }
export type Comparison = { baseline: Prediction; scenario: Prediction; score_change: number; threshold_crossed: boolean; changed_fields: string[] }
export type DatasetProfile = { rows: number; columns: number; labeled_rows: number; missing_targets: number; positive_rows: number; negative_rows: number; sha256?: string }
export type DatasetSummary = {
  profile: DatasetProfile
  labels: Array<{ label: string; count: number }>
  missingness: Array<{ feature: string; missing: number; rate: number }>
  credit_by_outcome: Array<{ label: string; mean: number; median: number; count: number }>
}
export type FeatureSchema = {
  feature: string; display_name: string; kind: 'numeric' | 'categorical'; used_by_model: boolean; derived: boolean; definition: string | null; missing: number; missing_rate: number
  categories?: string[]; summary?: { min: number | null; median: number | null; max: number | null }
}
export type DatasetSchema = { profile: DatasetProfile; features: FeatureSchema[] }
export type Preview = { total: number; offset: number; limit: number; columns: string[]; rows: Array<Record<string, string | number | null>> }
export type Distribution = {
  feature: string; display_name: string; kind: 'numeric' | 'categorical'; total: number; valid: number; missing: number
  series: Array<{ label: string; all: number; approved: number; not_approved: number; unknown: number; low?: number; high?: number }>
}
export type Relationship = {
  x: string; y: string; x_label: string; y_label: string; cohort_rows: number; full_count: number; shown_count: number; missing_count: number; correlation: number | null
  points: Array<{ x: number; y: number; outcome: string }>
}
export type Groups = {
  feature: string; display_name: string; total: number
  groups: Array<{ label: string; total: number; labeled: number; approved: number; not_approved: number; unknown: number; approval_rate: number | null }>
}
export type Candidate = { name: string; cv_f1_mean: number; cv_f1_std: number; cv_average_precision_mean: number; cv_recall_mean: number; cv_precision_mean: number }
export type ModelMetadata = {
  model_version: string; created_at: string; dataset: DatasetProfile & { sha256: string }; split: { seed: number; train_rows: number; validation_rows: number; test_rows: number }
  winner: { spec: { name: string; public_policy: boolean; engineered: boolean }; threshold: number; validation: Record<string, number> }
  test: Record<string, number> & { threshold: number; confusion: { tn: number; fp: number; fn: number; tp: number } }
  candidate_ranking: Candidate[]; limitations: string[]
}
