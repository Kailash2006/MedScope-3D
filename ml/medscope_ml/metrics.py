"""Standard + calibration metrics."""
from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    balanced_accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)


def compute_metrics(y_true, y_pred, y_proba, classes: list[str]) -> dict:
    p, r, f, support = precision_recall_fscore_support(
        y_true, y_pred, labels=classes, zero_division=0
    )
    per_class = {
        c: {"precision": float(p[i]), "recall": float(r[i]),
            "f1": float(f[i]), "support": int(support[i])}
        for i, c in enumerate(classes)
    }

    # multiclass Brier: mean over classes of one-vs-rest Brier
    briers = []
    y_true_arr = np.asarray(y_true)
    for i, c in enumerate(classes):
        briers.append(brier_score_loss((y_true_arr == c).astype(int), y_proba[:, i]))

    return {
        "macro_f1": float(f1_score(y_true, y_pred, labels=classes, average="macro", zero_division=0)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "brier_mean": float(np.mean(briers)),
        "per_class": per_class,
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=classes).tolist(),
        "classes": classes,
    }
