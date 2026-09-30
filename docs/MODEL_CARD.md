# Model notes

The model predicts `Loan_Approved` in the instructor-provided dataset. Scores are uncalibrated and do not predict repayment or default.

## Data and training

- 10,000 rows, 20 source columns; 9,950 labeled rows used for training/evaluation.
- 3,890 approved and 6,060 not-approved labels; 50 missing targets excluded.
- Seed 42 stratified split: 5,970 training, 1,990 validation, 1,990 test rows.
- Dataset SHA-256: `1764e49a721b390f22485576c894e1db26cf87ec015b6a60ff5370fad1b7112e`.
- Imputation, scaling, encoding, and optional feature engineering run in scikit-learn pipelines.
- Forty logistic regression configurations use five-fold training cross-validation. The top three candidates using the dashboard's 15 inputs advance to validation; validation F1 selects the model and threshold.
- Age, gender, and marital status are excluded from the served model.

## Results

Class-balanced L1 logistic regression, raw inputs, C=0.3, threshold 0.447.

| Test metric | Value |
|---|---:|
| F1 | 0.6844 |
| Precision | 0.5619 |
| Recall | 0.8753 |
| Accuracy | 0.6844 |
| Balanced accuracy | 0.7186 |
| ROC AUC | 0.7852 |
| Average precision | 0.6865 |

Confusion matrix: TN 681, FP 531, FN 97, TP 681. The audit rerun reproduced the stored results.

## Limits

This is a course dataset with undocumented source details, currency, and income period. It has already been explored; the fixed test split is not independent external validation. The F1-selected threshold produces many false positives, and the results do not establish performance on real applications.
