"""Dataset generator: schema, no-NaN, and safety-bias checks."""
from medscope_ml import features as F
from medscope_ml.generate import generate_dataframe

VALID = {"EMERGENCY", "URGENT_TODAY", "DOCTOR_SOON", "ROUTINE", "SELF_CARE"}


def test_columns_and_types():
    df = generate_dataframe(3000, seed=1, target_fraction=0.35)
    for col in F.feature_columns():
        assert col in df.columns
    assert {"urgency", "label_source", "age_band"}.issubset(df.columns)
    assert df[F.feature_columns()].isna().sum().sum() == 0


def test_labels_valid_and_safety_biased():
    df = generate_dataframe(4000, seed=2, target_fraction=0.35)
    assert set(df["urgency"]).issubset(VALID)
    # intentionally safety-biased: red-flag classes should be well represented
    emergency_frac = (df["urgency"] == "EMERGENCY").mean()
    assert emergency_frac > 0.20, emergency_frac
    assert set(df["label_source"]).issubset({"rule", "sampled"})


def test_rule_sourced_rows_are_high_urgency():
    df = generate_dataframe(4000, seed=3, target_fraction=0.4)
    rule_rows = df[df["label_source"] == "rule"]
    assert (rule_rows["urgency"].isin({"EMERGENCY", "URGENT_TODAY"})).all()
