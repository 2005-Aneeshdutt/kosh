"""Agent Studio endpoints — inspect and configure the crew."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services import studio

router = APIRouter(prefix="/api/studio", tags=["studio"])


@router.get("/config")
def get_config() -> dict:
    return studio.config()


class ToggleRequest(BaseModel):
    enabled: bool


@router.post("/agents/{key}")
def toggle_agent(key: str, req: ToggleRequest) -> dict:
    if key not in {"pulse", "oracle", "collect", "recon"}:
        raise HTTPException(status_code=404, detail="Unknown agent")
    studio.set_enabled(key, req.enabled)
    return studio.config()
