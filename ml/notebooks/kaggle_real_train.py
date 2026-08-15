# MedScope 3D — REAL-data training on Kaggle (Yale ED triage dataset).
# Dataset: maalona/hospital-triage-and-patient-history-data (560k real ED visits).
# Paste this whole block into one Kaggle notebook cell (GPU T4 accelerator on) and Run.
#
# It auto-detects the ESI target + triage features (no hand-typed column names),
# maps ESI 1-5 -> MedScope's 5 urgency levels, trains a calibrated XGBoost on GPU
# with EMERGENCY up-weighting + an emergency decision threshold, and reports the
# real metrics incl. the emergency-recall gate. Artifact saved to /kaggle/working.
import glob, json, os, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")

# ---------- locate + load the data (CSV or .RData) ----------
files = [f for f in glob.glob("/kaggle/input/**/*", recursive=True) if os.path.isfile(f)]
print("input files:", files)
csvs = [f for f in files if f.lower().endswith(".csv")]
rdatas = [f for f in files if f.lower().endswith((".rdata", ".rda"))]
SRC = None
if csvs:
    SRC = max(csvs, key=os.path.getsize)
    print("loading CSV:", SRC)
    raw = pd.read_csv(SRC, low_memory=False)
else:
    assert rdatas, f"No CSV or .RData under /kaggle/input: {files}"
    SRC = rdatas[0]
    print("loading RData:", SRC)
    import subprocess, sys
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pyreadr"], check=False)
    import pyreadr
    res = pyreadr.read_r(SRC)
    raw = list(res.values())[0]
print("raw shape:", raw.shape)
cols = list(raw.columns)
low = {c.lower(): c for c in cols}
print(f"{len(cols)} columns total")

def find(*cands):
    for c in cands:
        if c in low:
            return low[c]
    return None

# ---------- detect columns ----------
target = find("esi", "acuity", "triage_acuity", "acuity_level")
age = find("age", "age_on_arrival")
sex = find("gender", "sex")
vital_map = {
    "hr":   find("triage_vital_hr", "hr", "heartrate", "heart_rate", "pulse"),
    "sbp":  find("triage_vital_sbp", "sbp", "systolic", "bp_systolic"),
    "dbp":  find("triage_vital_dbp", "dbp", "diastolic", "bp_diastolic"),
    "rr":   find("triage_vital_rr", "rr", "resp_rate", "respiratoryrate"),
    "spo2": find("triage_vital_o2", "o2sat", "spo2", "o2_sat", "sao2", "oxygen_saturation"),
    "temp": find("triage_vital_temp", "temp", "temperature"),
}
cc_cols = [c for c in cols if c.lower().startswith("cc_")]
# Leakage-safe EXTRA features known at triage time (arrival + PRIOR history).
# Deliberately EXCLUDES: post-visit/outcome cols (disposition, labs, imaging) to
# avoid leakage, and protected attributes (race/ethnicity/insurance/religion/lang)
# to avoid baking demographic bias into a triage model.
SAFE_EXTRA = ["arrivalmode", "arrivalmonth", "arrivalday", "arrivalhour_bin",
              "n_edvisits", "n_admissions", "n_surgeries", "previousdispo", "dep_name",
              "maritalstatus", "employstatus"]
extra_cols = [low[c] for c in SAFE_EXTRA if c in low]
assert target, f"Could not find ESI/acuity target among columns: {cols[:40]}"
print("target:", target, "| age:", age, "| sex:", sex)
print("vitals:", {k: v for k, v in vital_map.items() if v})
print("chief-complaint columns:", len(cc_cols), "| safe-extra columns:", extra_cols)

use = [target] + [c for c in ([age, sex] + list(vital_map.values())) if c] + cc_cols + extra_cols
df = raw[use].copy()
del raw
print("selected", df.shape)

# ---------- ESI 1-5 -> MedScope urgency ----------
# Merge ESI 1 (resuscitation) + 2 (emergent) into EMERGENCY (standard high-acuity
# grouping) so EMERGENCY isn't a 0.9% rarity. SELF_CARE is intentionally unused:
# every row is an ED visit, so "self-care / no care needed" doesn't apply here.
URG = {1: "EMERGENCY", 2: "EMERGENCY", 3: "URGENT_TODAY", 4: "DOCTOR_SOON", 5: "ROUTINE"}
df[target] = pd.to_numeric(df[target], errors="coerce")
df = df[df[target].isin(URG)].copy()
y_str = df[target].map(URG)
print("class distribution:\n", y_str.value_counts())

# ---------- features ----------
feat = pd.DataFrame(index=df.index)
if age:
    feat["age"] = pd.to_numeric(df[age], errors="coerce")
for k, c in vital_map.items():
    if c:
        v = pd.to_numeric(df[c], errors="coerce")
        feat[k] = v
        feat[f"{k}_missing"] = v.isna().astype(int)
if sex:
    s = df[sex].astype(str).str.upper().str[0]
    feat["sex_M"] = (s == "M").astype(int)
    feat["sex_F"] = (s == "F").astype(int)
for c in cc_cols:
    feat[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype(np.int8)
# leakage-safe extras: numeric as-is (+missing flag); low-cardinality categoricals one-hot
for c in extra_cols:
    s = df[c]
    if pd.api.types.is_numeric_dtype(s):
        v = pd.to_numeric(s, errors="coerce")
        feat[c] = v
        feat[f"{c}_missing"] = v.isna().astype(int)
    else:
        dummies = pd.get_dummies(s.astype(str), prefix=c)
        if 1 < dummies.shape[1] <= 25:
            for dc in dummies.columns:
                feat[dc] = dummies[dc].astype(np.int8)
# median-impute numeric (missing flags already encoded)
for c in feat.columns:
    if feat[c].isna().any():
        feat[c] = feat[c].fillna(feat[c].median())
X = feat.to_numpy(dtype=np.float32)
print("feature matrix:", X.shape)

# ---------- train / val / test ----------
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
le = LabelEncoder(); y = le.fit_transform(y_str); classes = list(le.classes_)
Xtr, Xtmp, ytr, ytmp = train_test_split(X, y, test_size=0.30, random_state=42, stratify=y)
Xval, Xte, yval, yte = train_test_split(Xtmp, ytmp, test_size=0.50, random_state=42, stratify=ytmp)

ei = classes.index("EMERGENCY")
w = np.ones(len(ytr), np.float32); w[ytr == ei] = 2.0  # mild up-weight (rules backstop recall)

# ---------- XGBoost on GPU (falls back to CPU) ----------
from xgboost import XGBClassifier
from sklearn.calibration import CalibratedClassifierCV
try:
    import subprocess; subprocess.run(["nvidia-smi"], check=True, capture_output=True); device = "cuda"
except Exception:
    device = "cpu"
print("device:", device)

base = XGBClassifier(objective="multi:softprob", num_class=len(classes), tree_method="hist",
                     device=device, n_estimators=900, max_depth=10, learning_rate=0.05,
                     subsample=0.9, colsample_bytree=0.8, min_child_weight=3, reg_lambda=1.5,
                     eval_metric="mlogloss", n_jobs=-1)
clf = CalibratedClassifierCV(base, method="isotonic", cv=3)
clf.fit(Xtr, ytr, sample_weight=w)

# ---------- emergency decision threshold: pick tau that MAXIMIZES EMERGENCY F1 ----------
# (balances recall vs precision instead of brute-forcing recall; the app's rules
#  already guarantee emergency catching, so the ML optimizes discrimination.)
from sklearn.metrics import f1_score as _f1
pv = clf.predict_proba(Xval)
best_tau, best_f1 = 0.5, -1.0
for t in np.linspace(0.10, 0.90, 33):
    pr = pv.argmax(1).copy(); pr[pv[:, ei] >= t] = ei
    score = _f1((yval == ei).astype(int), (pr == ei).astype(int))
    if score > best_f1:
        best_f1, best_tau = score, float(t)
tau = best_tau
print(f"emergency tau={tau:.3f} (val EMERGENCY F1={best_f1:.3f})")

proba = clf.predict_proba(Xte)
pred = proba.argmax(1); pred[proba[:, ei] >= tau] = ei
yt = [classes[i] for i in yte]; yp = [classes[i] for i in pred]

# ---------- metrics ----------
from sklearn.metrics import f1_score, precision_recall_fscore_support, confusion_matrix, brier_score_loss
rank = {"EMERGENCY":5,"URGENT_TODAY":4,"DOCTOR_SOON":3,"ROUTINE":2,"SELF_CARE":1}
em_recall = float((np.array(yp)[np.array(yt) == "EMERGENCY"] == "EMERGENCY").mean())
under = float(np.mean([rank[p] < rank[t] for t, p in zip(yt, yp)]))
p, r, f, sup = precision_recall_fscore_support(yt, yp, labels=classes, zero_division=0)
brier = float(np.mean([brier_score_loss((np.array(yt) == c).astype(int), proba[:, i]) for i, c in enumerate(classes)]))

report = {
    "dataset": os.path.basename(SRC), "rows": int(len(df)), "features": int(X.shape[1]),
    "device": device, "classes": classes, "emergency_threshold": tau,
    "macro_f1": float(f1_score(yt, yp, average="macro", labels=classes, zero_division=0)),
    "emergency_recall": em_recall, "threshold_method": "max_emergency_f1",
    "under_triage_rate": under, "brier_mean": brier,
    "per_class": {c: {"precision": float(p[i]), "recall": float(r[i]), "f1": float(f[i]), "support": int(sup[i])} for i, c in enumerate(classes)},
    "confusion_matrix": confusion_matrix(yt, yp, labels=classes).tolist(),
}
print(json.dumps({k: report[k] for k in ["rows","features","device","macro_f1","emergency_recall","under_triage_rate","brier_mean","emergency_threshold"]}, indent=2))
print("per class:", json.dumps(report["per_class"], indent=2))

# ---------- save artifact (serving-compatible with medscope_ml.predict) ----------
import joblib
artifact = {"model": clf, "feature_columns": list(feat.columns), "classes": classes,
            "algo": "xgboost-real", "model_version": "real-v1.1.0",
            "confidence_threshold": 0.6, "emergency_threshold": tau,
            "device_trained": device, "dataset": report["dataset"],
            "metrics": {"macro_f1": report["macro_f1"], "emergency_recall": em_recall},
            "note": "Real Yale ED data; ESI1+2->EMERGENCY merge; +arrival/history features; tuned XGB."}
joblib.dump(artifact, "/kaggle/working/model_real-v1.1.0.joblib")
json.dump(report, open("/kaggle/working/metrics_real.json", "w"), indent=2)
print("saved /kaggle/working/model_real-v1.1.0.joblib + metrics_real.json")
