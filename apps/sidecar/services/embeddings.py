"""Small offline embedding service for semantic-ish local search."""
from __future__ import annotations

import hashlib
import math
import re

EMBEDDING_MODEL = "local-hashing-all-MiniLM-L6-v2-compatible"
EMBEDDING_DIMENSIONS = 384

_TOKEN_RE = re.compile(r"[a-z0-9]+")


class LocalEmbeddingService:
    """Generate deterministic CPU-only embeddings without network services."""

    def __init__(self, dimensions: int = EMBEDDING_DIMENSIONS) -> None:
        self.dimensions = dimensions

    def embed(self, text: str) -> list[float]:
        """Embed text into a normalized vector using signed feature hashing."""
        vector = [0.0] * self.dimensions
        tokens = _TOKEN_RE.findall(text.lower())
        if not tokens:
            return vector

        for token in tokens:
            digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
            bucket = int.from_bytes(digest[:4], "little") % self.dimensions
            sign = 1.0 if digest[4] & 1 else -1.0
            vector[bucket] += sign

            for ngram in _character_ngrams(token):
                ngram_digest = hashlib.blake2b(ngram.encode("utf-8"), digest_size=8).digest()
                ngram_bucket = int.from_bytes(ngram_digest[:4], "little") % self.dimensions
                ngram_sign = 1.0 if ngram_digest[4] & 1 else -1.0
                vector[ngram_bucket] += 0.25 * ngram_sign

        magnitude = math.sqrt(sum(value * value for value in vector))
        if magnitude == 0.0:
            return vector
        return [value / magnitude for value in vector]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    """Return cosine similarity for already-normalized vectors."""
    if not left or not right or len(left) != len(right):
        return 0.0
    return sum(a * b for a, b in zip(left, right, strict=True))


def _character_ngrams(token: str, size: int = 3) -> list[str]:
    if len(token) <= size:
        return [token]
    return [token[index : index + size] for index in range(len(token) - size + 1)]
