"""Kosh (कोष) — FastAPI application entry point.

One process serves BOTH the API and the built React app, so the whole product
lives at a single link (default http://localhost:8000).

Run from the repo root:
    python run.py                       # builds the frontend if needed, then serves
    uvicorn backend.main:app --port 8000
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.models import database
from backend.routers import (
    agents,
    auth,
    autopilot,
    chat,
    collections,
    dashboard,
    forecast,
    live,
    settings as settings_router,
    upload,
)

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

app = FastAPI(
    title="Kosh — Multi-Agent Revenue Operations for Razorpay Merchants",
    version="1.0.0",
    description="A crew of 4 AI agents that collect, reconcile, forecast, and monitor.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    database.init_db()
    # Kick off the live payment simulator so the dashboard is alive on load.
    from backend.services.simulator import simulator

    simulator.start()

    # Apply SMTP config from .env FIRST, so anything the agents send during
    # startup is delivered rather than silently queued.
    from backend.services import mailer

    if settings.smtp_host and settings.smtp_user:
        mailer.configure_smtp(
            host=settings.smtp_host, port=settings.smtp_port,
            username=settings.smtp_user, password=settings.smtp_password,
            from_email=settings.smtp_from or settings.smtp_user,
            from_name=settings.smtp_from_name,
        )
    if settings.mail_redirect:
        mailer.set_redirect(settings.mail_redirect)

    # Live Google Sheets ledger sync, if a webhook is configured.
    from backend.services import sheets

    if settings.sheets_webhook:
        sheets.configure(settings.sheets_webhook)

    # Seed the Autopilot approval queue with an initial scan (loop stays off
    # until the user enables Autopilot).
    from backend.services import autopilot

    try:
        autopilot.scan()
    except Exception:  # pragma: no cover
        pass


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "demo_mode": settings.demo_mode,
        "llm_enabled": settings.llm_enabled,
        "llm_provider": settings.llm_provider,
        "model": settings.active_model,
    }


app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(agents.router)
app.include_router(collections.router)
app.include_router(upload.router)
app.include_router(forecast.router)
app.include_router(settings_router.router)
app.include_router(live.router)
app.include_router(chat.router)
app.include_router(autopilot.router)


# ── Serve the built React SPA from the same origin ──────────
# Registered AFTER the API routers so /api/* always wins. When the frontend
# hasn't been built yet, a friendly message points the user at `python run.py`.
if (FRONTEND_DIST / "index.html").exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str) -> FileResponse:
        # Never let the SPA fallback swallow unknown API routes.
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        # Serve a real static file (favicon, logo, etc.) if it exists…
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        # …otherwise hand back index.html so client-side routing works on refresh.
        return FileResponse(FRONTEND_DIST / "index.html")

else:

    @app.get("/", include_in_schema=False)
    def frontend_not_built() -> dict:
        return {
            "message": "Frontend not built yet. Run `python run.py` (or "
            "`cd frontend && npm install && npm run build`) to serve the app "
            "from this link.",
            "api_docs": "/docs",
        }


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=settings.backend_port, reload=True)
