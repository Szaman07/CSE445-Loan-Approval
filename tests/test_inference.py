import copy

import joblib
import pytest

from creditwise import inference


def test_model_cache_refreshes_when_artifact_is_replaced(tmp_path, monkeypatch) -> None:
    bundle = copy.deepcopy(inference.load_bundle())
    path = tmp_path / "model.joblib"
    joblib.dump(bundle, path)
    monkeypatch.setattr(inference, "DEFAULT_MODEL_PATH", path)
    assert inference.load_bundle()["metadata"]["model_version"] == "0.1.0"
    bundle["metadata"]["model_version"] = "audit-replacement"
    joblib.dump(bundle, path)
    assert inference.load_bundle()["metadata"]["model_version"] == "audit-replacement"


def test_inconsistent_bundle_is_rejected(tmp_path, monkeypatch) -> None:
    bundle = copy.deepcopy(inference.load_bundle())
    bundle["threshold"] = 0.9
    path = tmp_path / "model.joblib"
    joblib.dump(bundle, path)
    monkeypatch.setattr(inference, "DEFAULT_MODEL_PATH", path)
    with pytest.raises(inference.ModelUnavailableError, match="invalid"):
        inference.load_bundle()
