"""Synthetic, safety-biased dataset generator.

Samples semantic cases, injects red-flag mechanisms to reach a target positive
fraction, labels them via labeler (shared red-flag table), and expands to the
canonical feature matrix. Emits <features...> + urgency + label_source + age_band.

Synthetic data is rule-seeded and NOT clinical data — see model card.
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import pandas as pd

from . import features as F
from .labeler import _threshold, label_record, resolve_band

_VITALS_RULES = F.red_flag_table()["vitals_rules"]

_BAND_WEIGHTS = [
    ("infant", 0.06), ("child", 0.15), ("adolescent", 0.10),
    ("adult", 0.45), ("older_adult", 0.24),
]
_BAND_AGE = {"infant": (0, 0), "child": (1, 11), "adolescent": (12, 17),
             "adult": (18, 64), "older_adult": (65, 92)}

_MILD_SYMPTOMS = ["headache", "abdominal_pain", "fever", "vomiting", "chest_pain",
                  "difficulty_breathing"]


def _sample_age(rng: random.Random) -> int:
    bands, weights = zip(*_BAND_WEIGHTS)
    band = rng.choices(bands, weights=weights)[0]
    lo, hi = _BAND_AGE[band]
    return rng.randint(lo, hi)


def _normal_vitals(rng: random.Random) -> dict:
    return {
        "hr": round(rng.gauss(80, 12), 1),
        "sbp": round(rng.gauss(120, 12), 1),
        "dbp": round(rng.gauss(78, 8), 1),
        "spo2": round(min(100, rng.gauss(98, 1.2)), 1),
        "temp_c": round(rng.gauss(36.9, 0.35), 1),
        "rr": round(rng.gauss(16, 3), 1),
    }


def _sample_benign(rng: random.Random) -> dict:
    age = _sample_age(rng)
    n_sym = rng.choices([0, 1, 2, 3], weights=[0.25, 0.4, 0.25, 0.1])[0]
    symptoms = []
    for code in rng.sample(_MILD_SYMPTOMS, k=min(n_sym, len(_MILD_SYMPTOMS))):
        symptoms.append({"code": code, "severity": rng.randint(1, 6),
                         "duration_hours": rng.choice([1, 6, 24, 72, 168])})
    regions = rng.sample(F._REGIONS, k=rng.choice([0, 1, 2]))
    risks = [r for r in F._RISKS if rng.random() < 0.12]
    return {"age": age, "sex": rng.choice(["M", "F", "O"]),
            "symptoms": symptoms, "regions": regions, "risk_factors": risks,
            "vitals": _normal_vitals(rng)}


def _inject_vital_redflag(rec: dict, rng: random.Random) -> None:
    band = resolve_band(rec["age"])
    rule = rng.choice(_VITALS_RULES)
    t = _threshold(rule, band)
    delta = rng.uniform(1, 8)
    val = t + delta if rule["op"] in (">", ">=") else t - delta
    rec["vitals"][rule["vital"]] = round(max(0, val), 1)


def _inject_symptom_redflag(rec: dict, rng: random.Random) -> None:
    templates = ["cardiac", "stroke", "airway", "anaphylaxis", "meningitis",
                 "hemorrhage", "sepsis"]
    t = rng.choice(templates)
    syms = rec["symptoms"]
    if t == "cardiac":
        syms.append({"code": "chest_pain", "severity": rng.randint(7, 10), "duration_hours": 1})
        rec["regions"] = list(set(rec["regions"]) | {rng.choice(["arm_left", "jaw"])})
        rec["risk_factors"] = list(set(rec["risk_factors"]) | {rng.choice(["hypertension", "smoker", "diabetes"])})
    elif t == "stroke":
        syms.append({"code": rng.choice(["facial_droop", "unilateral_weakness", "speech_difficulty"]),
                     "severity": rng.randint(3, 9), "duration_hours": 1})
    elif t == "airway":
        syms.append({"code": "difficulty_breathing", "severity": rng.randint(6, 10), "duration_hours": 1})
    elif t == "anaphylaxis":
        syms += [{"code": "swelling", "severity": rng.randint(4, 8), "duration_hours": 1},
                 {"code": "difficulty_breathing", "severity": rng.randint(5, 9), "duration_hours": 1}]
        rec["risk_factors"] = list(set(rec["risk_factors"]) | {"known_allergen_exposure"})
    elif t == "meningitis":
        syms += [{"code": "headache", "severity": rng.randint(6, 10), "duration_hours": 6},
                 {"code": "neck_stiffness", "severity": rng.randint(4, 9), "duration_hours": 6}]
        rec["vitals"]["temp_c"] = round(rng.uniform(38.2, 39.4), 1)
    elif t == "hemorrhage":
        syms.append({"code": "uncontrolled_bleeding", "severity": rng.randint(5, 10), "duration_hours": 1})
    elif t == "sepsis":
        syms.append({"code": "fever", "severity": rng.randint(4, 8), "duration_hours": 24})
        rec["vitals"]["temp_c"] = round(rng.uniform(38.1, 39.3), 1)
        rec["vitals"]["hr"] = round(rng.uniform(121, 129), 1)  # below adult vitals threshold (130)


def sample_record(rng: random.Random, target_fraction: float) -> dict:
    rec = _sample_benign(rng)
    if rng.random() < target_fraction:
        if rng.random() < 0.55:
            _inject_vital_redflag(rec, rng)
        else:
            _inject_symptom_redflag(rec, rng)
    return rec


def generate_dataframe(n_rows: int, seed: int, target_fraction: float) -> pd.DataFrame:
    rng = random.Random(seed)
    records, labels, sources, bands = [], [], [], []
    for _ in range(n_rows):
        rec = sample_record(rng, target_fraction)
        urgency, source = label_record(rec, rng)
        records.append(rec)
        labels.append(urgency)
        sources.append(source)
        bands.append(resolve_band(rec["age"]) or "unknown")

    df = F.build_frame(records)
    df["urgency"] = labels
    df["label_source"] = sources
    df["age_band"] = bands
    return df


def _write(df: pd.DataFrame, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        import pyarrow  # noqa: F401

        path = out_dir / "dataset.parquet"
        df.to_parquet(path, index=False)
    except Exception:  # noqa: BLE001 - parquet is best-effort; fall back to CSV
        path = out_dir / "dataset.csv"
        df.to_csv(path, index=False)
    return path


def main(argv: list[str] | None = None) -> None:
    import yaml

    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=str(Path(__file__).resolve().parents[1] / "config.yaml"))
    ap.add_argument("--n-rows", type=int, default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args(argv)

    cfg = yaml.safe_load(Path(args.config).read_text())
    ds = cfg["dataset"]
    n_rows = args.n_rows or ds["n_rows"]
    out_dir = Path(args.out) if args.out else Path(__file__).resolve().parents[1] / "data" / "generated"

    df = generate_dataframe(n_rows, ds["seed"], ds["redflag_target_fraction"])
    path = _write(df, out_dir)

    dist = df["urgency"].value_counts().to_dict()
    meta = {"n_rows": len(df), "seed": ds["seed"],
            "class_distribution": {k: int(v) for k, v in dist.items()},
            "redflag_rows": int((df["label_source"] == "rule").sum())}
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2))
    print(f"Wrote {path} ({len(df)} rows)")
    print("Class distribution:", meta["class_distribution"])


if __name__ == "__main__":
    main()
