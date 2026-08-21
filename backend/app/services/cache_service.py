"""Enterprise In-Memory Caching & Request Deduplication Engine."""
import hashlib
import time
from typing import Any, Optional

class EnterpriseAnalysisCache:
    """High-throughput TTL caching layer for instant repeat RFP/job analysis."""

    def __init__(self, default_ttl_seconds: int = 3600):
        self.cache: dict[str, dict[str, Any]] = {}
        self.default_ttl = default_ttl_seconds

    def _generate_key(self, text: str) -> str:
        cleaned = text.strip()[:1000]
        return hashlib.sha256(cleaned.encode("utf-8")).hexdigest()

    def get(self, text: str) -> Optional[dict]:
        key = self._generate_key(text)
        entry = self.cache.get(key)
        if entry:
            if time.time() < entry["expires_at"]:
                return entry["data"]
            else:
                del self.cache[key]
        return None

    def set(self, text: str, data: dict, ttl: Optional[int] = None):
        key = self._generate_key(text)
        expires_at = time.time() + (ttl or self.default_ttl)
        self.cache[key] = {
            "data": data,
            "expires_at": expires_at
        }


# Singleton cache instance
analysis_cache = EnterpriseAnalysisCache()
