# Experiment record

The original course work contained several incompatible evaluation paths. Some notebooks performed preprocessing before splitting, and the submitted notebook selected a threshold against test labels. Those outputs remain historical references and are excluded from the production evidence chain.

Notebook `6851.ipynb` provided the most credible starting point: a class-balanced L1 logistic regression with separate train, validation, and test partitions. Its saved test F1 was 0.6851 with 0.5634 precision and 0.8740 recall. It tuned the threshold on validation data, although several learned preprocessing choices occurred before the split.

The implementation moves every learned preprocessing step inside the pipeline and uses a fixed raw-row split. The first 40-candidate benchmark selected the privacy-aware raw policy and achieved 0.6844 F1 on the untouched test partition. This establishes a trustworthy baseline within 0.001 of notebook 6851.

Planned follow-up experiments are ordered by value rather than novelty:

1. Repeated stratified cross-validation and bootstrap confidence intervals to quantify score variance.
2. HistGradientBoosting, calibrated linear SVM, ExtraTrees, RandomForest, and gradient-boosted tree candidates under the same split contract.
3. Out-of-fold soft voting and rank averaging among genuinely complementary models.
4. Narrow validation threshold search around the precision-recall optimum, plus threshold stability across folds.
5. Probability calibration comparison using Brier score and reliability curves.
6. Feature ablation for engineered ratios, missingness indicators, and the privacy-aware policy.
7. Slice analysis by non-sensitive operational segments and subgroup analysis kept strictly descriptive.

Every follow-up must select models and thresholds without reading test labels. The test partition is used once for the final frozen candidate of a documented experiment round.
