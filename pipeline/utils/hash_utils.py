"""
Hash Utilities

Functions for computing hashes for deduplication.
"""
import json
import hashlib
from typing import Dict, Any, Set


# Fields to exclude from hash calculation
EXCLUDE_FIELDS: Set[str] = {'timestamp', 'timestamp_utc', '_id'}


def normalize_value(value: Any, ndigits: int = 3) -> Any:
    """Normalize value for consistent hashing"""
    if value is None:
        return None
    if isinstance(value, float):
        return round(value, ndigits)
    if isinstance(value, dict):
        return normalize_dict(value, ndigits)
    if isinstance(value, list):
        return [normalize_value(v, ndigits) for v in value]
    return value


def normalize_dict(data: Dict[str, Any], ndigits: int = 3) -> Dict[str, Any]:
    """
    Normalize dictionary for consistent hashing.
    Excludes timestamp fields and rounds floats.
    """
    normalized = {}
    for key in sorted(data.keys()):
        if key not in EXCLUDE_FIELDS:
            normalized[key] = normalize_value(data[key], ndigits)
    return normalized


def stable_hash(data: Dict[str, Any], ndigits: int = 3) -> str:
    """
    Compute stable hash of normalized data.
    Uses BLAKE2b for speed and security.
    
    Args:
        data: Dictionary to hash
        ndigits: Number of decimal places for floats
    
    Returns:
        Hash string (hex, 32 chars)
    """
    normalized = normalize_dict(data, ndigits)
    json_str = json.dumps(normalized, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.blake2b(json_str.encode('utf-8'), digest_size=16).hexdigest()


def is_duplicate(new_data: Dict[str, Any], last_hash: str, ndigits: int = 3) -> tuple:
    """
    Check if data is duplicate based on hash.
    
    Args:
        new_data: New data to check
        last_hash: Previous hash value
        ndigits: Number of decimal places for floats
    
    Returns:
        Tuple of (is_duplicate: bool, new_hash: str)
    """
    new_hash = stable_hash(new_data, ndigits)
    return (new_hash == last_hash, new_hash)
