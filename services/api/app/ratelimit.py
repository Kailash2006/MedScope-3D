"""Fixed-window rate limiting (per client IP + route).

In-process and thread-safe — sufficient for the prototype and fully testable. A
Redis-backed limiter is the horizontal-scale path (shares counters across API
instances); the interface here is intentionally small so that swap is easy.
"""
from __future__ import annotations

import threading
import time

from fastapi import HTTPException, Request, status

from .core.config import settings


class FixedWindowLimiter:
    def __init__(self, limit: int, window: float = 60.0) -> None:
        self.limit = limit
        self.window = window
        self._lock = threading.Lock()
        self._buckets: dict[str, tuple[float, int]] = {}

    def check(self, key: str) -> tuple[bool, int]:
        """Return (allowed, retry_after_seconds). limit<=0 disables limiting."""
        if self.limit <= 0:
            return True, 0
        now = time.monotonic()
        with self._lock:
            start, count = self._buckets.get(key, (now, 0))
            if now - start >= self.window:
                start, count = now, 0
            count += 1
            self._buckets[key] = (start, count)
            allowed = count <= self.limit
            retry = max(0, int(self.window - (now - start)))
            return allowed, retry


limiter = FixedWindowLimiter(settings.rate_limit_per_minute)


def rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    allowed, retry = limiter.check(f"{ip}:{request.url.path}")
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="rate limit exceeded",
            headers={"Retry-After": str(retry)},
        )
