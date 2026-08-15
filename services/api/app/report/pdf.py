"""Clinician-ready PDF triage report (fpdf2).

Always carries the disclaimer and the model + engine versions. ASCII-sanitized so
the built-in latin-1 core fonts never choke on unicode (degrees, subscripts, etc.).
"""
from __future__ import annotations

from datetime import UTC, datetime

from fpdf import FPDF
from fpdf.enums import XPos, YPos
from triage_shared import DISCLAIMER, advice_of, label_of

from ..models.db import Assessment, Session

_NL = {"new_x": XPos.LMARGIN, "new_y": YPos.NEXT}

_ACCENT = (14, 165, 233)
_MUTED = (100, 116, 139)
_RED = (239, 68, 68)

# Unicode -> ASCII replacements (escapes so file re-encoding can't corrupt them).
_REPL = {"°": " deg", "₂": "2", "≥": ">=", "≤": "<=",
         "—": "-", "→": "->"}


def _ascii(text: str) -> str:
    for k, v in _REPL.items():
        text = text.replace(k, v)
    return text.encode("latin-1", "replace").decode("latin-1")


class _Report(FPDF):
    def header(self) -> None:
        self.set_font("Helvetica", "B", 15)
        self.set_text_color(*_ACCENT)
        self.cell(0, 9, "MedScope 3D - Triage Report", **_NL)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*_RED)
        self.set_x(self.l_margin)
        self.multi_cell(self.epw, 4, _ascii(DISCLAIMER))
        self.ln(1)
        self.set_draw_color(*_MUTED)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)

    def footer(self) -> None:
        self.set_xy(self.l_margin, -14)  # set_y alone does not reset x
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(*_MUTED)
        self.multi_cell(self.epw, 3.5, _ascii(
            "Research/education prototype. NOT for clinical use. Not a diagnosis. "
            f"Page {self.page_no()}"))


def _kv(pdf: _Report, key: str, value: str) -> None:
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*_MUTED)
    pdf.cell(38, 5.5, _ascii(key))
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(20, 20, 20)
    avail = pdf.w - pdf.r_margin - pdf.get_x()
    pdf.multi_cell(avail, 5.5, _ascii(value))


def _section(pdf: _Report, title: str) -> None:
    pdf.ln(2)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(0, 6, _ascii(title), **_NL)


def build_report(session: Session, assessments: list[Assessment]) -> bytes:
    latest = assessments[-1] if assessments else None
    pdf = _Report()
    # Uncompressed so the report stays text-searchable (clinicians/tools); reports
    # are small enough that the size cost is negligible.
    pdf.set_compression(False)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    _kv(pdf, "Session ID", session.id)
    _kv(pdf, "Generated", datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC"))
    _kv(pdf, "Age / Sex", f"{session.age if session.age is not None else '-'} / {session.sex or '-'}")

    _section(pdf, "Urgency assessment")
    if latest:
        pdf.set_font("Helvetica", "B", 16)
        pdf.set_text_color(*_RED if latest.urgency == "EMERGENCY" else _ACCENT)
        pdf.cell(0, 9, _ascii(label_of(latest.urgency)), **_NL)
        _kv(pdf, "Advice", advice_of(latest.urgency))
        _kv(pdf, "Basis", latest.decision_path)
        _kv(pdf, "Confidence", f"{latest.confidence * 100:.0f}%")
        _kv(pdf, "Model version", latest.model_version)
        _kv(pdf, "Engine version", latest.engine_version)
        _kv(pdf, "Assessed at", latest.created_at.isoformat())
        if latest.reasons:
            _section(pdf, "Reasons")
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(20, 20, 20)
            for r in latest.reasons:
                pdf.set_x(pdf.l_margin)
                pdf.multi_cell(pdf.epw, 5, _ascii(f"- {r.get('message', '')}"))
    else:
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, "No assessment recorded yet.", **_NL)

    _section(pdf, "Current inputs")
    _kv(pdf, "Regions", ", ".join(session.regions or []) or "-")
    syms = session.symptoms or []
    _kv(pdf, "Symptoms", ", ".join(f"{s['code']} (sev {s.get('severity', 0)})" for s in syms) or "-")
    _kv(pdf, "Risk factors", ", ".join(session.risk_factors or []) or "-")
    v = session.vitals or {}
    vit = ", ".join(f"{k}={val}" for k, val in v.items() if val is not None) or "-"
    _kv(pdf, "Vitals", vit)

    if assessments:
        _section(pdf, "Assessment history")
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*_MUTED)
        for a in assessments:
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(pdf.epw, 4.5, _ascii(
                f"{a.created_at.strftime('%Y-%m-%d %H:%M:%S')}  |  {label_of(a.urgency)}  |  "
                f"{a.decision_path}  |  conf {a.confidence * 100:.0f}%"))

    out = pdf.output()
    return bytes(out)
