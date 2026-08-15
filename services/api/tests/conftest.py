"""Test config: isolated SQLite DB and an unreachable Redis (bridge no-ops).

Env is set BEFORE the app/config import so Settings picks it up.
"""
import os
from pathlib import Path

_DB_PATH = Path(__file__).parent / "_test_medscope.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_DB_PATH.as_posix()}")
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6399/0")  # refused fast -> in-process broadcast
os.environ.setdefault("ML_ARTIFACT_DIR", str(Path(__file__).parent / "_no_artifacts"))
os.environ.setdefault("ADMIN_TOKEN", "test-admin-token")
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "0")  # disabled by default; enabled in its own test

import pytest
import yaml
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as c:  # context manager runs lifespan (init_db, etc.)
        yield c


@pytest.fixture(scope="session")
def tmp_artifact(tmp_path_factory):
    """Train a tiny real model artifact so PredictionService tests have something to load."""
    from medscope_ml.train import save, train

    cfg = yaml.safe_load((Path(__file__).resolve().parents[3] / "ml" / "config.yaml").read_text())
    result = train(cfg, n_rows=6000, n_estimators=120, calibrate=False, model_choice="xgboost")
    out = tmp_path_factory.mktemp("artifacts")
    save(result, out)
    return out


def teardown_module():  # best-effort cleanup
    try:
        _DB_PATH.unlink(missing_ok=True)
    except OSError:
        pass
