from pathlib import Path

import pandas as pd
import pytest

from creditwise.data import EXPECTED_COLUMNS, labeled_xy, load_dataset


def test_unknown_target_is_rejected(tmp_path: Path) -> None:
    row = {column: 1 for column in EXPECTED_COLUMNS}
    row["Loan_Approved"] = "Maybe"
    path = tmp_path / "invalid.csv"
    pd.DataFrame([row]).to_csv(path, index=False)

    with pytest.raises(ValueError, match="Unexpected target"):
        load_dataset(path)


def test_target_and_identifier_are_not_features(tmp_path: Path) -> None:
    row = {column: 1 for column in EXPECTED_COLUMNS}
    row["Loan_Approved"] = "Yes"
    path = tmp_path / "valid.csv"
    pd.DataFrame([row]).to_csv(path, index=False)
    frame, _ = load_dataset(path)
    X, y = labeled_xy(frame)

    assert "Loan_Approved" not in X.columns
    assert "Applicant_ID" not in X.columns
    assert y.tolist() == [1]


@pytest.mark.parametrize("value", ["bad number", float("inf"), -float("inf")])
def test_invalid_numeric_data_is_rejected(tmp_path: Path, value) -> None:
    row = {column: 1 for column in EXPECTED_COLUMNS}
    row.update(Loan_Approved="Yes", Applicant_Income=value)
    path = tmp_path / "invalid.csv"
    pd.DataFrame([row]).to_csv(path, index=False)
    with pytest.raises(ValueError, match="Applicant_Income"):
        load_dataset(path)


def test_categories_are_trimmed_and_blank_values_are_missing(tmp_path: Path) -> None:
    row = {column: 1 for column in EXPECTED_COLUMNS}
    row.update(Loan_Approved="Yes", Employment_Status=" Salaried ", Loan_Purpose="  ")
    path = tmp_path / "categories.csv"
    pd.DataFrame([row]).to_csv(path, index=False)
    frame, _ = load_dataset(path)
    assert frame.loc[0, "Employment_Status"] == "Salaried"
    assert pd.isna(frame.loc[0, "Loan_Purpose"])
