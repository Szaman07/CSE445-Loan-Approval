# Experiment notes

Notebook `6851.ipynb` reported test F1 of 0.6851, precision of 0.5634, and recall of 0.8740. It selected its threshold on validation data, but some preprocessing happened before splitting. Other course notebooks used different evaluation methods, including test-label threshold selection, so their scores are not directly comparable.

The current implementation fits preprocessing within each training fold. It compares 40 logistic regression configurations: L1/L2 penalties, five C values, raw/engineered features, and full/15-input feature sets. The top three 15-input candidates by training cross-validation F1 advance to validation. Full-feature candidates are comparison baselines; they cannot become the dashboard model.

Validation F1 selects the model and threshold. The current winner is class-balanced L1 logistic regression, raw features, C=0.3, threshold 0.447. Test F1 is 0.6844. The audit rerun reproduced these results.

Possible follow-ups:

- Compare tree models and calibrated linear SVMs under the same preprocessing and split rules.
- Check threshold stability and model variation with repeated cross-validation.
- Test feature ablations and ensembles using development data.
- Evaluate calibration before calling scores probabilities.

Choose follow-up models and thresholds using training/validation data. This dataset has already been explored and evaluated; rerunning its fixed test split does not provide new independent evidence. Use new data for independent validation.
