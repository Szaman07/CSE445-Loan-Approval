import numpy as np
import pandas as pd
import pytest

from creditwise import training
from creditwise.data import PUBLIC_MODEL_FEATURES, labeled_xy, load_dataset
from creditwise.modeling import ModelSpec
from creditwise.settings import DEFAULT_DATA_PATH


def test_split_is_disjoint_complete_and_repeatable() -> None:
    X = pd.DataFrame({"x": np.arange(100)})
    y = pd.Series([0, 1] * 50)
    first = training.split_data(X, y)
    second = training.split_data(X, y)
    train, validation, test = map(set, first[-3:])
    assert not (train & validation or train & test or validation & test)
    assert train | validation | test == set(range(100))
    assert [len(part) for part in first[:3]] == [60, 20, 20]
    for a, b in zip(first[-3:], second[-3:], strict=True):
        np.testing.assert_array_equal(a, b)


def test_training_selects_a_servable_model_even_when_full_feature_cv_is_higher(tmp_path, monkeypatch) -> None:
    full = ModelSpec(name="full", public_policy=False, engineered=False)
    public = ModelSpec(name="public", public_policy=True, engineered=False)
    monkeypatch.setattr(training, "candidate_specs", lambda: [full, public])
    monkeypatch.setattr(training, "evaluate_candidate", lambda spec, X, y: training.CandidateResult(
        spec.name, 0.9 if spec.name == "full" else 0.6, 0.01, 0.7, 0.7, 0.6,
    ))
    monkeypatch.setattr(training, "MANIFEST_DIR", tmp_path / "manifests")
    frame, _ = load_dataset(DEFAULT_DATA_PATH)
    _, y = labeled_xy(frame.iloc[:250])
    monkeypatch.setattr(training, "load_dataset", lambda path: (frame.iloc[:250], load_dataset(path)[1]))
    metadata = training.train(DEFAULT_DATA_PATH, tmp_path / "model.joblib", tmp_path / "model.json")
    assert metadata["winner"]["spec"]["name"] == "public"
    assert metadata["feature_order"] == PUBLIC_MODEL_FEATURES
    assert metadata["candidate_ranking"][0]["name"] == "full"
    assert metadata["split"]["test_rows"] == pytest.approx(len(y) * 0.2, abs=1)
