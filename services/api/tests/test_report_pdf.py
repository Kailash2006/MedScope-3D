"""Clinician PDF report: valid PDF, includes disclaimer + model version, fast."""
import time


def test_report_is_pdf_with_required_content(client):
    sid = client.post("/api/v1/sessions", json={"age": 61, "sex": "M"}).json()["id"]
    client.patch(f"/api/v1/sessions/{sid}", json={"vitals": {"spo2": 85}})

    t0 = time.perf_counter()
    r = client.get(f"/api/v1/sessions/{sid}/report.pdf")
    elapsed = time.perf_counter() - t0

    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:5] == b"%PDF-"
    assert "attachment" in r.headers.get("content-disposition", "")
    assert elapsed < 3.0, f"PDF generation took {elapsed:.2f}s (>3s budget)"

    text = r.content.decode("latin-1", "ignore")
    # PDF text streams contain the literal strings we wrote.
    assert "Triage Report" in text
    assert "Not a diagnosis" in text  # disclaimer present
    assert "Engine version" in text   # model/engine provenance present


def test_report_missing_session_404(client):
    assert client.get("/api/v1/sessions/nope/report.pdf").status_code == 404
