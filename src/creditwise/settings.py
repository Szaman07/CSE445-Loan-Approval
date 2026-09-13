from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_ROOT = PROJECT_ROOT.parent

DEFAULT_DATA_PATH = PROJECT_ROOT / "data" / "loan_approval_data.csv"
ARTIFACT_DIR = PROJECT_ROOT / "artifacts"
MODEL_DIR = ARTIFACT_DIR / "models"
MANIFEST_DIR = ARTIFACT_DIR / "manifests"
DEFAULT_MODEL_PATH = MODEL_DIR / "creditwise_model.joblib"
DEFAULT_METADATA_PATH = MODEL_DIR / "creditwise_model.json"

RANDOM_SEED = 42
TARGET_COLUMN = "Loan_Approved"
ID_COLUMN = "Applicant_ID"
