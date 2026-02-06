"""
Time Utilities

Functions for parsing and formatting time values.
"""
import re
from datetime import datetime, timedelta
from typing import Any, Optional, Union
import pytz

TZ = pytz.timezone('Asia/Bangkok')


def parse_int(value: Any, default: int = 0) -> int:
    """Safely parse integer from various types"""
    if value is None:
        return default
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        s = value.strip()
        # Handle strings like "123", "123.0", "123 h 25 m"
        m = re.search(r"-?\d+(?:\.\d+)?", s)
        if m:
            try:
                return int(float(m.group(0)))
            except Exception:
                return default
        return default
    try:
        return int(value)
    except Exception:
        return default


def parse_float(value: Any, default: float = 0.0) -> float:
    """Safely parse float from various types"""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def parse_h_m_to_seconds(text: str) -> int:
    """
    Parse "X h Y m" format to total seconds.
    
    Examples:
        "522 h 19 m" -> 1880340
        "0 h 0 m" -> 0
    """
    if not text:
        return 0
    h = 0
    m = 0
    mh = re.search(r'(\d+)\s*h', text)
    mm = re.search(r'(\d+)\s*m', text)
    if mh:
        h = int(mh.group(1))
    if mm:
        m = int(mm.group(1))
    return h * 3600 + m * 60


def fmt_seconds_to_h_m(seconds: int) -> str:
    """
    Format seconds to "X h Y m" string.
    
    Examples:
        1880340 -> "522 h 19 m"
        0 -> "0 h 0 m"
    
    DEPRECATED: Use seconds directly instead of this format.
    """
    seconds = max(0, int(seconds or 0))
    h = seconds // 3600
    m = (seconds % 3600) // 60
    return f"{h} h {m} m"


def get_seconds(seconds: int) -> int:
    """
    Return seconds as-is (for consistency).
    Use this instead of fmt_seconds_to_h_m.
    
    Examples:
        1880340 -> 1880340
        0 -> 0
    """
    return max(0, int(seconds or 0))


def calculate_initial_seconds(commit_date: str, end_date: str) -> int:
    """
    Calculate initial seconds from commitDate to endDate.
    
    Args:
        commit_date: "2023-12-28" format
        end_date: "2025-10-02T16:00:00" format
    
    Returns:
        Total seconds between dates
    """
    try:
        # Parse commit date
        if 'T' in commit_date:
            dt_commit = datetime.fromisoformat(commit_date.replace('Z', '+00:00'))
        else:
            dt_commit = datetime.strptime(commit_date, "%Y-%m-%d")
        
        # Parse end date
        if 'T' in end_date:
            dt_end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        else:
            dt_end = datetime.strptime(end_date, "%Y-%m-%d")
        
        # Make both timezone-aware or naive
        if dt_commit.tzinfo is None:
            dt_commit = TZ.localize(dt_commit)
        if dt_end.tzinfo is None:
            dt_end = TZ.localize(dt_end)
        
        diff = dt_end - dt_commit
        return max(0, int(diff.total_seconds()))
    
    except Exception as e:
        return 0


def now_tz() -> datetime:
    """Get current datetime with timezone"""
    return datetime.now(TZ)


def now_utc() -> datetime:
    """Get current UTC datetime"""
    from datetime import timezone
    return datetime.now(timezone.utc)


def is_stale(last_ts: Optional[datetime], timeout_seconds: int = 180) -> bool:
    """Check if timestamp is stale (older than timeout)"""
    if last_ts is None:
        return True
    
    now = now_tz()
    
    # Make last_ts timezone-aware if needed
    if last_ts.tzinfo is None:
        last_ts = TZ.localize(last_ts)
    
    elapsed = (now - last_ts).total_seconds()
    return elapsed > timeout_seconds


def get_status_from_timestamp(last_ts: Optional[datetime], timeout_seconds: int = 180) -> str:
    """Get 'Active' or 'Inactive' based on timestamp freshness"""
    return "Inactive" if is_stale(last_ts, timeout_seconds) else "Active"
