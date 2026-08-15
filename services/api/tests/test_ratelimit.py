"""Rate limiting returns 429 past the per-window limit (disabled elsewhere)."""
import pytest

from app.ratelimit import limiter


@pytest.fixture()
def low_limit():
    original = limiter.limit
    limiter.limit = 3
    limiter._buckets.clear()
    yield
    limiter.limit = original
    limiter._buckets.clear()


def test_create_session_rate_limited(client, low_limit):
    codes = [client.post("/api/v1/sessions", json={}).status_code for _ in range(6)]
    assert codes.count(201) == 3       # first 3 allowed
    assert 429 in codes                 # subsequent limited
    # a 429 carries Retry-After
    r = client.post("/api/v1/sessions", json={})
    assert r.status_code == 429
    assert "retry-after" in {k.lower() for k in r.headers}


def test_disabled_when_limit_zero(client):
    # default test config disables limiting -> many creates all succeed
    assert all(client.post("/api/v1/sessions", json={}).status_code == 201 for _ in range(10))
