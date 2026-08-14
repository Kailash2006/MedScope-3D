"""MedScope offline ML pipeline (Phase 2).

Modules:
  features    - expand a semantic case into the ordered feature vector (skew guard)
  labeler     - apply the shared red-flag table + synthetic non-red-flag scoring
  generate    - synthetic, safety-biased dataset generator
  train       - LR + XGBoost training with isotonic calibration
  metrics     - standard + calibration metrics
  safety_eval - emergency-recall gate + under-triage reporting
"""
__all__ = ["features", "generate", "labeler", "metrics", "safety_eval", "train"]
