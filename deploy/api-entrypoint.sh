#!/bin/sh
# API container entrypoint.
# - If MODEL_URL is set and no model is present yet, download it into
#   ML_ARTIFACT_DIR (so hosts without a mounted volume, e.g. Render, can serve
#   the ML model). If MODEL_URL is unset, the API runs rules-only (safe).
# - Bind to $PORT if the platform sets one (Render/Fly), else 8000 (compose/local).
# Schema: the app calls init_db() (create_all) at startup, so tables exist on
# first boot without a separate migration step. Use Alembic for controlled
# migrations in managed environments (see DEPLOYMENT.md).
set -e

ART_DIR="${ML_ARTIFACT_DIR:-/app/ml/artifacts}"
mkdir -p "$ART_DIR"

if [ -n "$MODEL_URL" ] && [ ! -f "$ART_DIR/model_deployed.joblib" ]; then
  echo "[entrypoint] downloading model from MODEL_URL ..."
  python -c "import os,urllib.request; d=os.environ.get('ML_ARTIFACT_DIR','/app/ml/artifacts'); urllib.request.urlretrieve(os.environ['MODEL_URL'], os.path.join(d,'model_deployed.joblib'))"
  echo "[entrypoint] model ready at $ART_DIR/model_deployed.joblib"
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
