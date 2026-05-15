"""Transparent file-based vector store for local document search."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from uuid import UUID

from sqlalchemy.orm import Session

from models import Sheet, SheetText
from services.embeddings import LocalEmbeddingService, cosine_similarity  # type: ignore[reportMissingImports]


@dataclass(frozen=True)
class VectorRecord:
    id: str
    project_id: str
    document_id: str
    sheet_id: str
    page_index: int
    text: str
    bbox: list[float]
    embedding: list[float]


@dataclass(frozen=True)
class SearchResult:
    document_id: str
    sheet_id: str
    page_index: int
    text: str
    bbox: list[float]
    score: float


class LocalVectorStore:
    """Persist vectors in project-local JSONL files."""

    def __init__(self, project_path: Path, embedding_service: LocalEmbeddingService | None = None) -> None:
        self.project_path = project_path.expanduser().resolve()
        self.embedding_service = embedding_service or LocalEmbeddingService()
        self.store_dir = self.project_path / "vectors"
        self.store_path = self.store_dir / "sheet_text.jsonl"

    def index_document(self, session: Session, project_id: UUID, document_id: UUID) -> int:
        """Index extracted SheetText rows for one document."""
        self.store_dir.mkdir(parents=True, exist_ok=True)
        existing = [record for record in self._read_records() if record.document_id != str(document_id)]

        rows = (
            session.query(SheetText, Sheet)
            .join(Sheet, SheetText.sheet_id == Sheet.id)
            .filter(Sheet.document_id == document_id)
            .order_by(SheetText.page_index, SheetText.created_at)
            .all()
        )

        new_records: list[VectorRecord] = []
        for text_row, sheet in rows:
            for chunk_index, text_chunk in enumerate(chunk_text(text_row.text)):
                new_records.append(
                    VectorRecord(
                        id=f"{text_row.id}:{chunk_index}",
                        project_id=str(project_id),
                        document_id=str(document_id),
                        sheet_id=str(sheet.id),
                        page_index=text_row.page_index,
                        text=text_chunk,
                        bbox=[text_row.bbox_x0, text_row.bbox_y0, text_row.bbox_x1, text_row.bbox_y1],
                        embedding=self.embedding_service.embed(text_chunk),
                    )
                )

        self._write_records(existing + new_records)
        return len(new_records)

    def search(self, query: str, project_id: UUID, limit: int = 10) -> list[SearchResult]:
        """Search project vectors by cosine similarity."""
        query_embedding = self.embedding_service.embed(query)
        scored: list[SearchResult] = []
        for record in self._read_records():
            if record.project_id != str(project_id):
                continue
            score = cosine_similarity(query_embedding, record.embedding)
            if score <= 0.0:
                continue
            scored.append(
                SearchResult(
                    document_id=record.document_id,
                    sheet_id=record.sheet_id,
                    page_index=record.page_index,
                    text=record.text,
                    bbox=record.bbox,
                    score=score,
                )
            )
        scored.sort(key=lambda result: result.score, reverse=True)
        return scored[:limit]

    def _read_records(self) -> list[VectorRecord]:
        if not self.store_path.exists():
            return []
        records: list[VectorRecord] = []
        with self.store_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    records.append(VectorRecord(**json.loads(line)))
        return records

    def _write_records(self, records: list[VectorRecord]) -> None:
        self.store_dir.mkdir(parents=True, exist_ok=True)
        with self.store_path.open("w", encoding="utf-8") as handle:
            for record in records:
                handle.write(json.dumps(asdict(record), separators=(",", ":")) + "\n")


def chunk_text(text: str, max_chars: int = 900) -> list[str]:
    """Split oversized OCR spans into compact chunks."""
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    if len(cleaned) <= max_chars:
        return [cleaned]

    chunks: list[str] = []
    words = cleaned.split(" ")
    current: list[str] = []
    current_len = 0
    for word in words:
        next_len = current_len + len(word) + (1 if current else 0)
        if current and next_len > max_chars:
            chunks.append(" ".join(current))
            current = [word]
            current_len = len(word)
        else:
            current.append(word)
            current_len = next_len
    if current:
        chunks.append(" ".join(current))
    return chunks
