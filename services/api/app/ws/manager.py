"""WebSocket connection manager.

Delivers live assessments to every connection watching a session. Single-instance
delivery works in-process; when Redis is available, messages are published to a
per-session channel and a subscriber rebroadcasts locally, so multiple API
instances stay in sync (horizontal scale). Redis is optional — absence falls back
to direct in-process broadcast, so tests need no Redis.
"""
from __future__ import annotations

import asyncio
import contextlib
import json

from fastapi import WebSocket

_CHANNEL = "medscope:session:"


class ConnectionManager:
    def __init__(self) -> None:
        self._local: dict[str, set[WebSocket]] = {}
        self._redis = None
        self._task: asyncio.Task | None = None

    async def connect(self, session_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._local.setdefault(session_id, set()).add(ws)

    def disconnect(self, session_id: str, ws: WebSocket) -> None:
        conns = self._local.get(session_id)
        if conns:
            conns.discard(ws)
            if not conns:
                self._local.pop(session_id, None)

    async def _broadcast_local(self, session_id: str, message: dict) -> None:
        for ws in list(self._local.get(session_id, ())):
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001 - drop dead sockets
                self.disconnect(session_id, ws)

    async def publish(self, session_id: str, message: dict) -> None:
        if self._redis is not None:
            await self._redis.publish(_CHANNEL + session_id, json.dumps(message))
        else:
            await self._broadcast_local(session_id, message)

    async def start_redis(self, url: str) -> None:
        try:
            import redis.asyncio as aioredis

            self._redis = aioredis.from_url(url)
            await self._redis.ping()
            self._task = asyncio.create_task(self._listen())
        except Exception:  # noqa: BLE001 - no Redis => in-process broadcast only
            self._redis = None

    async def _listen(self) -> None:
        pubsub = self._redis.pubsub()
        await pubsub.psubscribe(_CHANNEL + "*")
        async for msg in pubsub.listen():
            if msg.get("type") != "pmessage":
                continue
            channel = msg["channel"]
            if isinstance(channel, bytes):
                channel = channel.decode()
            session_id = channel.rsplit(":", 1)[1]
            with contextlib.suppress(Exception):
                await self._broadcast_local(session_id, json.loads(msg["data"]))

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        if self._redis is not None:
            with contextlib.suppress(Exception):
                await self._redis.aclose()


manager = ConnectionManager()
