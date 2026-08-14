"""Loads the canonical JSON schema files shared with the TS package."""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

# schema/ lives at packages/triage-shared/schema — two levels up from this file's
# package dir (triage_shared -> python -> triage-shared). Allow override for Docker.
_DEFAULT_SCHEMA_DIR = Path(__file__).resolve().parents[2] / "schema"
SCHEMA_DIR = Path(os.environ.get("TRIAGE_SHARED_SCHEMA_DIR", str(_DEFAULT_SCHEMA_DIR)))


@lru_cache(maxsize=None)
def load_schema(name: str) -> Any:
    path = SCHEMA_DIR / name
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def red_flag_table() -> dict:
    return load_schema("redflags.table.json")


def feature_contract() -> dict:
    return load_schema("features.schema.json")
