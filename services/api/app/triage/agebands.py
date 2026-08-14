from __future__ import annotations

from triage_shared import red_flag_table

_TABLE = red_flag_table()
_BANDS = _TABLE["age_bands"]


def resolve_band(age: int | None) -> str | None:
    """Map an age (years) to its band, or None when age is unknown."""
    if age is None:
        return None
    for b in _BANDS:
        if b["min_years"] <= age <= b["max_years"]:
            return b["band"]
    # Above the top band's max_years still maps to the oldest band (defensive).
    return _BANDS[-1]["band"]
