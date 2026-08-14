"""MedScope triage safety engine (Phase 1: deterministic rules, no ML).

Evaluation order (deterministic, safety-first):
  1. completeness gate        -> INSUFFICIENT_INFO if nothing assessable
  2. vitals red-flag rules    -> EMERGENCY short-circuit candidates
  3. symptom red-flag rules   -> EMERGENCY / URGENT_TODAY candidates
  4. ML                       -> (Phase 2; absent here -> conservative fallback)
  5. conservative fallback    -> safe floor when no red flag / no model
  6. escalate-only merge      -> final never sits below any red flag

Rules can only ESCALATE urgency, never downgrade it.
"""
from .engine import assess
from .models import SymptomEntry, TriageInput, TriageResult, Vitals

__all__ = ["SymptomEntry", "TriageInput", "TriageResult", "Vitals", "assess"]
