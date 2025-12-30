from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional


def datetime_to_utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """
    Convert datetime to an ISO-8601 string in UTC.

    Why:
    - Some DBs (e.g. SQLite) return naive datetimes even when columns are timezone=True.
    - If we return a naive ISO string (no offset), browsers may parse it as local time,
      causing a visible time shift (e.g. UTC interpreted as Asia/Shanghai).
    """
    if dt is None:
        return None

    if dt.tzinfo is None:
        dt_utc = dt.replace(tzinfo=timezone.utc)
    else:
        dt_utc = dt.astimezone(timezone.utc)

    s = dt_utc.isoformat()
    # Normalize "+00:00" to "Z" for better JS interop.
    if s.endswith("+00:00"):
        s = s[:-6] + "Z"
    return s


