"""Train LR + XGBoost triage models, calibrate, evaluate against the emergency
recall gate, and save artifacts.

CPU by default; set train.device=cuda (or auto) to use a GPU. Multi-GPU training
lives in ml/notebooks/medscope_kaggle_train.ipynb (Dask-CUDA + xgboost.dask).
"""
from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from xgboost import XGBClassifier

from . import features as F
from . import metrics as M
from . import safety_eval as S
from .generate import generate_dataframe

ROOT = Path(__file__).resolve().parents[1]


def resolve_device(pref: str) -> str:
    if pref in ("cpu", "cuda"):
        return pref
    # auto: use cuda only when an NVIDIA GPU is actually visible. build_info()'s
    # USE_CUDA flag is unreliable on some wheels, so probe for a real device.
    import os
    import shutil

    if shutil.which("nvidia-smi") or os.environ.get("CUDA_VISIBLE_DEVICES"):
        return "cuda"
    return "cpu"


def _build_xgb(device: str, xcfg: dict, n_classes: int) -> XGBClassifier:
    return XGBClassifier(
        objective="multi:softprob",
        num_class=n_classes,
        tree_method="hist",
        device=device,
        n_estimators=xcfg["n_estimators"],
        max_depth=xcfg["max_depth"],
        learning_rate=xcfg["learning_rate"],
        subsample=xcfg["subsample"],
        colsample_bytree=xcfg["colsample_bytree"],
        eval_metric="mlogloss",
        n_jobs=-1,
    )


def _fit(estimator, X, y, do_calibrate: bool, sample_weight=None):
    if do_calibrate:
        cal = CalibratedClassifierCV(estimator, method="isotonic", cv=3)
        cal.fit(X, y, sample_weight=sample_weight)
        return cal
    if sample_weight is not None:
        estimator.fit(X, y, sample_weight=sample_weight)
    else:
        estimator.fit(X, y)
    return estimator


def _sample_weights(y_enc, classes: list[str], emergency_w: float, urgent_w: float):
    w = np.ones(len(y_enc), dtype=np.float32)
    idx = {c: i for i, c in enumerate(classes)}
    if "EMERGENCY" in idx:
        w[y_enc == idx["EMERGENCY"]] = emergency_w
    if "URGENT_TODAY" in idx:
        w[y_enc == idx["URGENT_TODAY"]] = urgent_w
    return w


def _decide(proba, classes: list[str], tau_e: float):
    """Safety-biased decision rule: predict EMERGENCY when its probability clears
    tau_e, otherwise take the argmax class. Directly controls emergency recall."""
    pred = proba.argmax(axis=1)
    if "EMERGENCY" in classes:
        ei = classes.index("EMERGENCY")
        pred = pred.copy()
        pred[proba[:, ei] >= tau_e] = ei
    return pred


def tune_emergency_threshold(model, X_val, y_val_enc, classes: list[str],
                             target_recall: float) -> float:
    """Largest tau (<=0.5) whose EMERGENCY recall on validation meets target."""
    if "EMERGENCY" not in classes:
        return 0.5
    ei = classes.index("EMERGENCY")
    proba = model.predict_proba(X_val)
    true_em = proba[y_val_enc == ei, ei]
    if len(true_em) == 0:
        return 0.5
    # a small margin above target so the test set clears the gate too
    q = float(np.quantile(true_em, max(0.0, 1.0 - target_recall - 0.01)))
    return float(min(max(q, 0.05), 0.5))


def _evaluate(model, X, y_enc, classes: list[str], tau_e: float) -> tuple[dict, dict]:
    proba = model.predict_proba(X)
    pred_enc = _decide(proba, classes, tau_e)
    y_true = [classes[i] for i in y_enc]
    y_pred = [classes[i] for i in pred_enc]
    std = M.compute_metrics(y_true, y_pred, proba, classes)
    return std, {"y_true": y_true, "y_pred": y_pred}


def train(cfg: dict, n_rows: int | None = None, n_estimators: int | None = None,
          calibrate: bool | None = None, model_choice: str | None = None) -> dict:
    ds, tr, ev, art = cfg["dataset"], cfg["train"], cfg["evaluation"], cfg["artifacts"]
    n_rows = n_rows or ds["n_rows"]
    do_cal = tr["calibrate"] if calibrate is None else calibrate
    model_choice = model_choice or tr["model"]
    if n_estimators:
        tr["xgboost"]["n_estimators"] = n_estimators

    df = generate_dataframe(n_rows, ds["seed"], ds["redflag_target_fraction"])
    cols = F.feature_columns()
    X = df[cols].to_numpy(dtype=np.float32)
    le = LabelEncoder()
    y = le.fit_transform(df["urgency"].to_numpy())
    classes = list(le.classes_)

    X_tr, X_tmp, y_tr, y_tmp = train_test_split(
        X, y, test_size=ds["test_size"] + ds["val_size"], random_state=ds["seed"], stratify=y)
    rel_val = ds["val_size"] / (ds["test_size"] + ds["val_size"])
    X_val, X_te, y_val, y_te = train_test_split(
        X_tmp, y_tmp, test_size=1 - rel_val, random_state=ds["seed"], stratify=y_tmp)

    device = resolve_device(tr["device"])
    print(f"[train] rows={n_rows} classes={classes} device={device} calibrate={do_cal}")

    # --- Logistic Regression baseline ---
    lr = make_pipeline(
        StandardScaler(),
        LogisticRegression(max_iter=1000, class_weight="balanced"),
    )
    target = ev["emergency_recall_min"]
    lr = _fit(lr, X_tr, y_tr, do_cal)  # LR uses class_weight, no sample_weight
    lr_tau = tune_emergency_threshold(lr, X_val, y_val, classes, target)
    lr_metrics, lr_pred = _evaluate(lr, X_te, y_te, classes, lr_tau)
    lr_safety = S.safety_report(lr_pred["y_true"], lr_pred["y_pred"], target)

    # --- XGBoost (GPU-capable), with EMERGENCY-upweighted samples (safety) ---
    sw = _sample_weights(y_tr, classes, tr.get("emergency_weight", 5.0), tr.get("urgent_weight", 1.5))
    xgb = _build_xgb(device, tr["xgboost"], len(classes))
    xgb = _fit(xgb, X_tr, y_tr, do_cal, sample_weight=sw)
    xgb_tau = tune_emergency_threshold(xgb, X_val, y_val, classes, target)
    xgb_metrics, xgb_pred = _evaluate(xgb, X_te, y_te, classes, xgb_tau)
    xgb_safety = S.safety_report(xgb_pred["y_true"], xgb_pred["y_pred"], target)

    print(f"[LR ] macro_f1={lr_metrics['macro_f1']:.4f} "
          f"emergency_recall={lr_safety['emergency_recall']:.4f} gate={lr_safety['gate_passed']}")
    print(f"[XGB] macro_f1={xgb_metrics['macro_f1']:.4f} "
          f"emergency_recall={xgb_safety['emergency_recall']:.4f} gate={xgb_safety['gate_passed']}")

    chosen = {
        "xgboost": (xgb, xgb_metrics, xgb_safety, xgb_tau),
        "logreg": (lr, lr_metrics, lr_safety, lr_tau),
    }[model_choice]
    model, chosen_metrics, chosen_safety, chosen_tau = chosen

    artifact = {
        "model": model,
        "feature_columns": cols,
        "classes": classes,
        "algo": model_choice,
        "model_version": art["model_version"],
        "engine_compatible": True,
        "confidence_threshold": ev["confidence_threshold"],
        "emergency_threshold": chosen_tau,
        "device_trained": device,
        "trained_at": datetime.now(UTC).isoformat(),
        "dataset": {"n_rows": int(n_rows), "seed": ds["seed"],
                    "redflag_target_fraction": ds["redflag_target_fraction"]},
        "metrics": chosen_metrics,
        "safety": chosen_safety,
    }
    report = {
        "chosen": model_choice,
        "logreg": {"metrics": lr_metrics, "safety": lr_safety, "emergency_threshold": lr_tau},
        "xgboost": {"metrics": xgb_metrics, "safety": xgb_safety, "emergency_threshold": xgb_tau},
        "dataset": artifact["dataset"], "device": device,
        "class_distribution": {c: int((df["urgency"] == c).sum()) for c in classes},
    }
    return {"artifact": artifact, "report": report}


def save(result: dict, art_dir: Path) -> None:
    art_dir.mkdir(parents=True, exist_ok=True)
    artifact = result["artifact"]
    joblib.dump(artifact, art_dir / f"model_{artifact['model_version']}.joblib")
    (art_dir / "metrics.json").write_text(json.dumps(result["report"], indent=2))
    _write_model_card_metrics(art_dir, result)


def _write_model_card_metrics(art_dir: Path, result: dict) -> None:
    a, rep = result["artifact"], result["report"]
    s, m = a["safety"], a["metrics"]
    lines = [
        f"<!-- auto-generated by train.py at {a['trained_at']} -->",
        f"- model_version: `{a['model_version']}`  algo: `{a['algo']}`  device: `{a['device_trained']}`",
        f"- dataset: {a['dataset']['n_rows']} synthetic rows (seed {a['dataset']['seed']})",
        f"- macro_f1: {m['macro_f1']:.4f}   balanced_accuracy: {m['balanced_accuracy']:.4f}   brier_mean: {m['brier_mean']:.4f}",
        (f"- **emergency_recall: {s['emergency_recall']:.4f}** (gate >= {s['emergency_recall_min']}: "
         f"{'PASS' if s['gate_passed'] else 'FAIL'}), emergency_missed: {s['emergency_missed']}"),
        f"- under_triage_rate: {s['under_triage_rate']:.4f}",
        f"- class_distribution: {rep['class_distribution']}",
    ]
    (art_dir / "metrics_summary.md").write_text("\n".join(lines) + "\n")


def main(argv: list[str] | None = None) -> None:
    import yaml

    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=str(ROOT / "config.yaml"))
    ap.add_argument("--n-rows", type=int, default=None)
    ap.add_argument("--n-estimators", type=int, default=None)
    ap.add_argument("--model", choices=["xgboost", "logreg"], default=None)
    ap.add_argument("--no-calibrate", action="store_true")
    ap.add_argument("--out", default=None)
    args = ap.parse_args(argv)

    cfg = yaml.safe_load(Path(args.config).read_text())
    result = train(cfg, n_rows=args.n_rows, n_estimators=args.n_estimators,
                   calibrate=(False if args.no_calibrate else None), model_choice=args.model)
    art_dir = Path(args.out) if args.out else ROOT / cfg["artifacts"]["dir"]
    save(result, art_dir)
    s = result["artifact"]["safety"]
    print(f"[save] artifact -> {art_dir}  emergency_recall={s['emergency_recall']:.4f} "
          f"gate={'PASS' if s['gate_passed'] else 'FAIL'}")


if __name__ == "__main__":
    main()
