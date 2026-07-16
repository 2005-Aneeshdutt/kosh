"""Kosh Copilot chat endpoint."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from backend.services import copilot

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@router.post("")
def chat(req: ChatRequest) -> dict:
    return copilot.chat([m.model_dump() for m in req.messages])
