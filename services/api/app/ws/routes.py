"""WebSocket endpoint: /ws/sessions/{id} — autosave + live urgency recompute."""
from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError

from ..audit import logger as audit
from ..core.db import SessionLocal
from ..models.db import Session
from ..schemas.session import SessionUpdate
from ..session_service import apply_patch, latest_assessment, recompute_and_store
from .manager import manager

router = APIRouter(tags=["websocket"])


def _persist(session_id: str, patch: SessionUpdate, predictor) -> dict:
    """Synchronous DB work (runs in a threadpool). Autosave = commit on every patch."""
    db = SessionLocal()
    try:
        row = db.get(Session, session_id)
        if row is None:
            return {"error": "session not found"}
        apply_patch(row, patch)
        result = recompute_and_store(db, row, predictor)
        audit.record(db, "session.ws_update", "session", session_id,
                     meta={"decision_path": result.decision_path, "urgency": result.urgency})
        db.commit()
        return result.model_dump(mode="json")
    finally:
        db.close()


def _current(session_id: str) -> dict | None:
    db = SessionLocal()
    try:
        if db.get(Session, session_id) is None:
            return None
        latest = latest_assessment(db, session_id)
        return {
            "urgency": latest.urgency, "decision_path": latest.decision_path,
            "confidence": latest.confidence, "assessed_at": latest.created_at.isoformat(),
        } if latest else {}
    finally:
        db.close()


@router.websocket("/ws/sessions/{session_id}")
async def ws_session(websocket: WebSocket, session_id: str) -> None:
    predictor = getattr(websocket.app.state, "predictor", None)
    await manager.connect(session_id, websocket)

    current = await run_in_threadpool(_current, session_id)
    if current is None:
        await websocket.send_json({"type": "error", "message": "session not found"})
        manager.disconnect(session_id, websocket)
        await websocket.close()
        return
    await websocket.send_json({"type": "connected", "session_id": session_id, "latest": current})

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") != "update":
                await websocket.send_json({"type": "error", "message": "expected type=update"})
                continue
            try:
                patch = SessionUpdate(**(data.get("patch") or {}))
            except ValidationError as exc:
                await websocket.send_json({"type": "error", "message": exc.errors(include_url=False)})
                continue
            result = await run_in_threadpool(_persist, session_id, patch, predictor)
            if "error" in result:
                await websocket.send_json({"type": "error", "message": result["error"]})
                continue
            await manager.publish(session_id, {"type": "assessment", "data": result})
            await websocket.send_json({"type": "saved"})
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)
