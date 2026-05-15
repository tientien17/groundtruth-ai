"""Tests for cited local RAG Copilot flow."""
from __future__ import annotations

import asyncio
from pathlib import Path
from uuid import UUID, uuid4

from database import get_session, init_db
from models import Document, Project, Sheet, SheetText
from services.ai_router import AIResponse
from services.rag import SYSTEM_PROMPT, Citation, answer_question, build_prompt
from services.vector_store import LocalVectorStore


PROJECT_ID = UUID("00000000-0000-0000-0000-000000000020")
DOCUMENT_ID = UUID("00000000-0000-0000-0000-000000000120")
SHEET_ID = UUID("00000000-0000-0000-0000-000000001020")


def create_indexed_project(tmp_path: Path) -> Path:
    project_path = tmp_path / "Copilot.gtl"
    project_path.mkdir()
    db_path = project_path / "project.sqlite"
    init_db(db_path)

    with get_session(db_path) as session:
        session.add(Project(id=PROJECT_ID, name="Copilot", path=str(project_path)))
        session.add(
            Document(
                id=DOCUMENT_ID,
                project_id=PROJECT_ID,
                filename="plans.pdf",
                original_path=str(project_path / "plans.pdf"),
            )
        )
        session.add(Sheet(id=SHEET_ID, document_id=DOCUMENT_ID, sheet_number="C-201", page_index=2))
        session.add(
            SheetText(
                id=uuid4(),
                sheet_id=SHEET_ID,
                page_index=2,
                text="reinforced concrete headwall detail at storm drain outfall",
                bbox_x0=1,
                bbox_y0=2,
                bbox_x1=30,
                bbox_y1=40,
                source="native",
            )
        )
        session.flush()
        LocalVectorStore(project_path).index_document(session, PROJECT_ID, DOCUMENT_ID)

    return project_path


def test_build_prompt_requires_context_only_answer():
    prompt = build_prompt(
        "Where is the headwall?",
        [
            Citation(
                index=1,
                document_id=str(DOCUMENT_ID),
                sheet_id=str(SHEET_ID),
                sheet_number="C-201",
                page=3,
                text="headwall detail",
                score=0.9,
            )
        ],
    )

    assert "Use only the context below" in prompt
    assert "I don't know based on the indexed PDF content." in prompt
    assert "Sheet Number: C-201" in prompt
    assert "Page: 3" in prompt
    assert "Do not use outside knowledge" in SYSTEM_PROMPT


def test_answer_question_returns_answer_and_sheet_page_citations(tmp_path: Path, monkeypatch):
    project_path = create_indexed_project(tmp_path)
    captured: dict[str, str] = {}

    async def fake_ai_generate(project_id, db_path, prompt, *, system=None, timeout=120.0):
        captured["prompt"] = prompt
        captured["system"] = system or ""
        return AIResponse(text="Headwall detail appears on C-201 page 3. [1]")

    monkeypatch.setattr("services.rag.ai_generate", fake_ai_generate)

    result = asyncio.run(
        answer_question(
            project_id=PROJECT_ID,
            project_path=project_path,
            question="storm drain headwall",
        )
    )

    assert result.answer == "Headwall detail appears on C-201 page 3. [1]"
    assert result.citations[0].sheet_number == "C-201"
    assert result.citations[0].page == 3
    assert "Sheet Number: C-201" in captured["prompt"]
    assert "Page: 3" in captured["prompt"]
    assert "Answer ONLY from the provided project context" in captured["system"]


def test_answer_question_returns_unknown_without_context(tmp_path: Path, monkeypatch):
    project_path = tmp_path / "Empty.gtl"
    project_path.mkdir()
    init_db(project_path / "project.sqlite")

    async def fail_ai_generate(*args, **kwargs):
        raise AssertionError("AI should not run without retrieved context")

    monkeypatch.setattr("services.rag.ai_generate", fail_ai_generate)

    result = asyncio.run(
        answer_question(
            project_id=PROJECT_ID,
            project_path=project_path,
            question="missing detail",
        )
    )

    assert result.answer == "I don't know based on the indexed PDF content."
    assert result.citations == []
