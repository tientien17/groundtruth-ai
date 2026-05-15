"""Copilot chat endpoint backed by local cited retrieval."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.rag import answer_question


router = APIRouter(prefix="/projects", tags=["copilot"])


class CopilotChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=4000)
    limit: int = Field(default=6, ge=1, le=12)


class CopilotCitationResponse(BaseModel):
    index: int
    document_id: str
    sheet_id: str
    sheet_number: str
    page: int
    text: str
    score: float


class CopilotChatResponse(BaseModel):
    answer: str
    citations: list[CopilotCitationResponse]


@router.post("/{project_id}/copilot/chat")
async def copilot_chat(
    project_id: UUID,
    body: CopilotChatRequest,
    project_path: str = Query(...),
) -> CopilotChatResponse:
    """Answer project question using only indexed local PDF context."""
    resolved_project_path = Path(project_path).expanduser().resolve()
    if not (resolved_project_path / "project.sqlite").exists():
        raise HTTPException(status_code=404, detail="Project database not found")

    try:
        result = await answer_question(
            project_id=project_id,
            project_path=resolved_project_path,
            question=body.question,
            limit=body.limit,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return CopilotChatResponse(
        answer=result.answer,
        citations=[CopilotCitationResponse(**citation.__dict__) for citation in result.citations],
    )
