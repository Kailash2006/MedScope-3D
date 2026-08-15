# MedScope 3D — APP-COMPATIBLE real-data training on Kaggle.
# Trains on the real Yale ED dataset but builds EXACTLY the app's 51-column
# feature schema (medscope_ml.features.feature_columns()), so the saved artifact
# is a DROP-IN for the app's PredictionService (skew guard passes).
#
# Cost of compatibility: the app only collects age/sex/6 vitals/11 symptoms/
# 5 risk factors/regions — far less than the 287-feature model. Regions, per-symptom
# severity and duration don't exist in Yale (set to 0/absent), so this model is
# WEAKER than real-v1.1.0. That's the honest price of serving in the current UI.
import glob, json, os, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")

# ---- the app's exact feature order (from medscope_ml.features.feature_columns()) ----
APP_COLS = ["age","severity_max","duration_hours","hr","sbp","dbp","spo2","temp_c","rr",
    "hr_missing","sbp_missing","dbp_missing","spo2_missing","temp_c_missing","rr_missing",
    "sex_M","sex_F","sex_O","sex_unknown",
    "band_infant","band_child","band_adolescent","band_adult","band_older_adult","band_unknown",
    "region_chest_left","region_chest_right","region_arm_left","region_arm_right","region_jaw",
    "region_head","region_abdomen","region_back","region_leg_left","region_leg_right",
    "sym_chest_pain","sym_difficulty_breathing","sym_abdominal_pain","sym_headache","sym_fever",
    "sym_vomiting","sym_facial_droop","sym_unilateral_weakness","sym_speech_difficulty",
    "sym_swelling","sym_neck_stiffness",
    "risk_hypertension","risk_smoker","risk_diabetes","risk_pregnancy","risk_known_allergen_exposure"]
VITAL_FILL = {"hr":80.0,"sbp":120.0,"dbp":78.0,"spo2":98.0,"temp_c":37.0,"rr":16.0}
BANDS = [("infant",0,0),("child",1,11),("adolescent",12,17),("adult",18,64),("older_adult",65,130)]

# ---- load Yale (RData) ----
files = [f for f in glob.glob("/kaggle/input/**/*", recursive=True) if os.path.isfile(f)]
rdatas = [f for f in files if f.lower().endswith((".rdata",".rda"))]
csvs = [f for f in files if f.lower().endswith(".csv")]
if csvs:
    SRC = max(csvs, key=os.path.getsize); raw = pd.read_csv(SRC, low_memory=False)
else:
    import subprocess, sys
    subprocess.run([sys.executable,"-m","pip","install","-q","pyreadr"], check=False)
    import pyreadr; SRC = rdatas[0]; raw = list(pyreadr.read_r(SRC).values())[0]
cols = list(raw.columns); low = {c.lower(): c for c in cols}
print("raw shape:", raw.shape)

def find(*cands):
    for c in cands:
        if c in low: return low[c]
    return None
target = find("esi","acuity"); age_c = find("age"); sex_c = find("gender","sex")
VIT = {"hr":find("triage_vital_hr","hr"),"sbp":find("triage_vital_sbp","sbp"),
       "dbp":find("triage_vital_dbp","dbp"),"rr":find("triage_vital_rr","rr"),
       "spo2":find("triage_vital_o2","o2sat","spo2"),"temp_c":find("triage_vital_temp","temp")}
cc = [c for c in cols if c.lower().startswith("cc_")]

# ---- keyword maps: app symptom/risk -> Yale columns ----
SYM_KW = {"chest_pain":["chestpain","chest"],"difficulty_breathing":["shortnessofbreath","dyspnea","breath","sob"],
    "abdominal_pain":["abdominalpain","abdominal","abdpain"],"headache":["headache"],"fever":["fever"],
    "vomiting":["vomit","nausea"],"facial_droop":["facialdroop","facial"],
    "unilateral_weakness":["weakness","hemiparesis","focalweak"],"speech_difficulty":["speech","dysarthria","slurred","aphasia"],
    "swelling":["swelling","edema"],"neck_stiffness":["neckstiff","neckpain","neck"]}
RISK_KW = {"hypertension":["hypertension","htn"],"smoker":["smok","tobacco"],
    "diabetes":["diabetes","diabetic"],"pregnancy":["pregnan"],"known_allergen_exposure":["allerg","anaphylax"]}
def match_cols(pool, kws): return [c for c in pool if any(k in c.lower() for k in kws)]
sym_src = {s: match_cols(cc, kw) for s, kw in SYM_KW.items()}
risk_src = {r: match_cols(cols, kw) for r, kw in RISK_KW.items()}
print("symptom matches:", {k: len(v) for k, v in sym_src.items()})
print("risk matches:", {k: len(v) for k, v in risk_src.items()})

# ---- label: ESI 1-5 -> app's 5 urgency levels (1:1, keeps all 5 app levels) ----
URG = {1:"EMERGENCY",2:"URGENT_TODAY",3:"DOCTOR_SOON",4:"ROUTINE",5:"SELF_CARE"}
esi = pd.to_numeric(raw[target], errors="coerce")
keep = esi.isin(URG); raw = raw[keep].copy(); esi = esi[keep]
y_str = esi.map(URG)
print("class distribution:\n", y_str.value_counts())

# ---- build the app's 51-column feature matrix ----
n = len(raw); feat = pd.DataFrame(0.0, index=raw.index, columns=APP_COLS, dtype=np.float32)
feat["age"] = pd.to_numeric(raw[age_c], errors="coerce") if age_c else np.nan
feat["severity_max"] = 0.0     # Yale has no per-symptom severity
feat["duration_hours"] = 0.0   # Yale has no duration
for k, c in VIT.items():
    v = pd.to_numeric(raw[c], errors="coerce") if c else pd.Series(np.nan, index=raw.index)
    feat[f"{k}_missing"] = v.isna().astype(np.float32)
    feat[k] = v.fillna(VITAL_FILL[k])
feat["age"] = feat["age"].fillna(40.0)
# sex one-hot
sx = raw[sex_c].astype(str).str.upper().str[0] if sex_c else pd.Series("U", index=raw.index)
feat["sex_M"] = (sx == "M").astype(np.float32); feat["sex_F"] = (sx == "F").astype(np.float32)
feat["sex_O"] = 0.0; feat["sex_unknown"] = (~sx.isin(["M","F"])).astype(np.float32)
# age band one-hot
a = feat["age"]
for name, lo, hi in BANDS:
    feat[f"band_{name}"] = ((a >= lo) & (a <= hi)).astype(np.float32)
feat["band_unknown"] = 0.0
# regions: not in Yale -> stay 0
# symptoms from matched cc_ columns (binary present)
for s, srcs in sym_src.items():
    if srcs:
        feat[f"sym_{s}"] = (raw[srcs].apply(pd.to_numeric, errors="coerce").fillna(0).max(axis=1) > 0).astype(np.float32)
# risk factors from matched columns
for r, srcs in risk_src.items():
    if srcs:
        feat[f"risk_{r}"] = (raw[srcs].apply(pd.to_numeric, errors="coerce").fillna(0).max(axis=1) > 0).astype(np.float32)
del raw
X = feat[APP_COLS].to_numpy(dtype=np.float32)
print("app feature matrix:", X.shape, "(must be 51 cols)")

# ---- train ----
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.calibration import CalibratedClassifierCV
from xgboost import XGBClassifier
le = LabelEncoder(); y = le.fit_transform(y_str); classes = list(le.classes_)
Xtr,Xtmp,ytr,ytmp = train_test_split(X,y,test_size=0.30,random_state=42,stratify=y)
Xval,Xte,yval,yte = train_test_split(Xtmp,ytmp,test_size=0.50,random_state=42,stratify=ytmp)
try:
    import subprocess; subprocess.run(["nvidia-smi"],check=True,capture_output=True); device="cuda"
except Exception: device="cpu"
ei = classes.index("EMERGENCY")
w = np.ones(len(ytr),np.float32); w[ytr==ei] = 3.0
base = XGBClassifier(objective="multi:softprob",num_class=len(classes),tree_method="hist",device=device,
    n_estimators=700,max_depth=8,learning_rate=0.06,subsample=0.9,colsample_bytree=0.9,
    min_child_weight=3,eval_metric="mlogloss",n_jobs=-1)
clf = CalibratedClassifierCV(base, method="isotonic", cv=3); clf.fit(Xtr,ytr,sample_weight=w)
print("device:", device)

# ---- emergency threshold: max EMERGENCY F1 on val ----
from sklearn.metrics import f1_score, precision_recall_fscore_support, brier_score_loss
pv = clf.predict_proba(Xval); best_tau, best = 0.5, -1
for t in np.linspace(0.10,0.90,33):
    pr = pv.argmax(1).copy(); pr[pv[:,ei]>=t]=ei
    s = f1_score((yval==ei).astype(int),(pr==ei).astype(int))
    if s>best: best,best_tau = s,float(t)
tau = best_tau
proba = clf.predict_proba(Xte); pred = proba.argmax(1); pred[proba[:,ei]>=tau]=ei
yt = [classes[i] for i in yte]; yp = [classes[i] for i in pred]
p,r,f,sup = precision_recall_fscore_support(yt,yp,labels=classes,zero_division=0)
brier = float(np.mean([brier_score_loss((np.array(yt)==c).astype(int),proba[:,i]) for i,c in enumerate(classes)]))
report = {"rows":int(len(X)),"features":X.shape[1],"device":device,"classes":classes,"emergency_threshold":tau,
    "macro_f1":float(f1_score(yt,yp,average="macro",labels=classes,zero_division=0)),
    "emergency_recall":float((np.array(yp)[np.array(yt)=="EMERGENCY"]=="EMERGENCY").mean()),"brier_mean":brier,
    "per_class":{c:{"precision":float(p[i]),"recall":float(r[i]),"f1":float(f[i]),"support":int(sup[i])} for i,c in enumerate(classes)}}
print(json.dumps({k:report[k] for k in ["rows","features","device","macro_f1","emergency_recall","brier_mean","emergency_threshold"]}, indent=2))
print("per class:", json.dumps(report["per_class"], indent=2))

# ---- save DROP-IN artifact (feature_columns == app schema) ----
import joblib
assert list(feat.columns) == APP_COLS, "feature order must match the app schema exactly"
artifact = {"model":clf,"feature_columns":APP_COLS,"classes":classes,"algo":"xgboost-real-appcompat",
    "model_version":"v2.0.0-real-appcompat","confidence_threshold":0.6,"emergency_threshold":tau,
    "device_trained":device,"dataset":os.path.basename(SRC),
    "metrics":{"macro_f1":report["macro_f1"],"emergency_recall":report["emergency_recall"]},
    "note":"Real Yale ED data mapped to the app's 51-col schema; DROP-IN for PredictionService."}
joblib.dump(artifact, "/kaggle/working/model_v2.0.0-real-appcompat.joblib")
json.dump(report, open("/kaggle/working/metrics_appcompat.json","w"), indent=2)
print("saved /kaggle/working/model_v2.0.0-real-appcompat.joblib + metrics_appcompat.json")
