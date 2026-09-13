# CreditWise model card

## Purpose

CreditWise predicts the historical `Loan_Approved` label in the supplied academic dataset. It is an educational portfolio system for demonstrating leakage-safe classification, threshold selection, API serving, and product communication. Its score is not a real underwriting decision or a calibrated probability of repayment.

## Data

- 10,000 rows and 20 columns.
- 9,950 labeled rows; 50 rows have no target and are excluded from supervised training.
- 3,890 positive and 6,060 negative labeled examples.
- Dataset SHA-256: `1764e49a721b390f22485576c894e1db26cf87ec015b6a60ff5370fad1b7112e`.
- Fixed seed 42 split: 5,970 train, 1,990 validation, and 1,990 test rows.

The privacy-aware policy excludes age, gender, and marital status. This is a product design choice for the demonstration; it is not evidence of regulatory compliance or fairness.

## Training protocol

All imputation, missing indicators, scaling, categorical encoding, and optional feature engineering run inside scikit-learn pipelines. Forty logistic-regression configurations are compared with five-fold stratified cross-validation on the training partition. The strongest three are fitted on training data and their classification thresholds are tuned only on validation data. The chosen pipeline and threshold are then evaluated once on untouched test labels.

## Current evaluated result

The first implementation selected a class-balanced L1 logistic regression using the privacy-aware raw feature policy, `C=0.3`, and threshold `0.447`.

| Test metric | Value |
|---|---:|
| F1 | 0.6844 |
| Precision | 0.5619 |
| Recall | 0.8753 |
| Accuracy | 0.6844 |
| Balanced accuracy | 0.7186 |
| ROC AUC | 0.7852 |
| Average precision | 0.6865 |

The test confusion matrix is TN 681, FP 531, FN 97, TP 681. The result closely reproduces the earlier notebook's 0.6851 F1 while preserving an untouched test set.

## Limitations

- The dataset is synthetic or course-provided and does not establish real-world performance.
- The target describes past labels rather than loan repayment or default.
- Dataset provenance, consent, collection dates, and population coverage are not documented in the source material.
- High recall comes with many false positives; the threshold reflects F1, not a real lending cost function.
- Group fairness cannot be claimed merely because selected sensitive fields are excluded; proxy effects may remain.
- Predictions should be treated as model demonstrations and reviewed with the disclosed threshold and version.
