"""Retrieval-augmented Copilot chat grounded in project-local sheet text."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from database import get_session, init_db
from models import Sheet
from services.ai_router import ai_generate
from services.vector_store import LocalVectorStore, SearchResult


SYSTEM_PROMPT = """You are GroundTruth Local Copilot.
Answer ONLY from the provided project context.
If the context does not contain the answer, say: "I don't know based on the indexed PDF content."
Do not use outside knowledge. Do not guess. Do not invent quantities, sheet numbers, pages, or citations.
When you answer, cite relevant context using bracket citations like [1]."""


@dataclass(frozen=True)
class Citation:
    """Citation target for a retrieved sheet/page span."""

    index: int
    document_id: str
    sheet_id: str
    sheet_number: str
    page: int
    text: str
    score: float


@dataclass(frozen=True)
class RagAnswer:
    """Copilot answer plus clickable citations."""

    answer: str
    citations: list[Citation]


async def answer_question(
    *,
    project_id: UUID,
    project_path: Path,
    question: str,
    limit: int = 6,
) -> RagAnswer:
    """Search local vectors, build grounded prompt, and call local AI router."""
    clean_question = " ".join(question.split())
    if not clean_question:
        return RagAnswer(answer="Ask a question about the indexed PDF content.", citations=[])

    resolved_project_path = project_path.expanduser().resolve()
    db_path = resolved_project_path / "project.sqlite"
    init_db(db_path)

    search_results = LocalVectorStore(resolved_project_path).search(
        clean_question,
        project_id,
        limit=limit,
    )
    citations = _build_citations(db_path, search_results)
    if not citations:
        return RagAnswer(
            answer="I don't know based on the indexed PDF content.",
            citations=[],
        )

    prompt = build_prompt(clean_question, citations)
    response = await ai_generate(
        project_id,
        db_path,
        prompt,
        system=SYSTEM_PROMPT,
    )
    return RagAnswer(answer=response.text.strip(), citations=citations)


def build_prompt(question: str, citations: list[Citation]) -> str:
    """Build strict context-only prompt for cited answer generation."""
    context_blocks = "\n\n".join(
        (
            f"[{citation.index}] Sheet Number: {citation.sheet_number}\n"
            f"Page: {citation.page}\n"
            f"Text: {citation.text}"
        )
        for citation in citations
    )
    return f"""Use only the context below to answer the question.
Every factual statement must be supported by the context.
If the answer is missing, say exactly: "I don't know based on the indexed PDF content."

Context:
{context_blocks}

Question: {question}

Answer with concise explanation and bracket citations."""


def _build_citations(db_path: Path, results: list[SearchResult]) -> list[Citation]:
    if not results:
        return []

    sheet_ids = {result.sheet_id for result in results}
    with get_session(db_path) as session:
        sheets = (
            session.query(Sheet)
            .filter(Sheet.id.in_([UUID(sheet_id) for sheet_id in sheet_ids]))
            .all()
        )
        sheet_numbers = {str(sheet.id): sheet.sheet_number for sheet in sheets}

    citations: list[Citation] = []
    for index, result in enumerate(results, start=1):
        citations.append(
            Citation(
                index=index,
                document_id=result.document_id,
                sheet_id=result.sheet_id,
                sheet_number=sheet_numbers.get(result.sheet_id, "Unknown"),
                page=result.page_index + 1,
                text=result.text,
                score=result.score,
            )
        )
    return citations
