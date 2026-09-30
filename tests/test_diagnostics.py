import json
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest

from creditwise.diagnostics import _calibration_bins, _coefficient_rows, _test_indices


@pytest.fixture
def frozen_split(tmp_path):
    manifest = {
        "dataset_sha256": "frozen-hash", "seed": 17,
        "train_indices": [0, 3, 5], "validation_indices": [2], "test_indices": [4, 1],
    }
    bundle = {"metadata": {
        "dataset": {"sha256": "frozen-hash"},
        "split": {"seed": 17, "train_rows": 3, "validation_rows": 1, "test_rows": 2},
    }}
    path = tmp_path / "manifest.json"
    profile = SimpleNamespace(sha256="frozen-hash", labeled_rows=6)
    return bundle, profile, manifest, path


def test_preserves_saved_test_order_and_nondefault_seed(frozen_split):
    bundle, profile, manifest, path = frozen_split
    path.write_text(json.dumps(manifest))
    assert _test_indices(bundle, profile, path) == [4, 1]


@pytest.mark.parametrize("change", ["data", "manifest_hash", "seed", "overlap", "range", "count", "bool"])
def test_rejects_mismatched_or_invalid_split(frozen_split, change):
    bundle, profile, manifest, path = frozen_split
    if change == "data":
        profile.sha256 = "different-data"
    elif change == "manifest_hash":
        manifest["dataset_sha256"] = "different-data"
    elif change == "seed":
        manifest["seed"] = 42
    elif change == "overlap":
        manifest["test_indices"] = [4, 3]
    elif change == "range":
        manifest["test_indices"] = [4, 6]
    elif change == "count":
        manifest["test_indices"] = [4]
    else:
        manifest["test_indices"] = [4, True]
    path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError):
        _test_indices(bundle, profile, path)


def test_constant_scores_do_not_look_perfectly_calibrated():
    bins = _calibration_bins(pd.Series([1, 1, 1, 0]), np.full(4, 0.2))
    assert len(bins) == 1
    assert bins[0]["rows"] == 4
    assert bins[0]["absolute_gap"] == pytest.approx(0.55)


def test_coefficients_are_grouped_by_actual_sign():
    pipeline = SimpleNamespace(named_steps={
        "preprocessor": SimpleNamespace(get_feature_names_out=lambda: ["a", "b", "c", "d"]),
        "classifier": SimpleNamespace(coef_=np.array([[3, 1, 0, -2]])),
    })
    rows = _coefficient_rows(pipeline)
    assert [row["feature"] for row in rows["positive"]] == ["a", "b"]
    assert [row["feature"] for row in rows["negative"]] == ["d"]
