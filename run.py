"""Kosh — one command, one link.

Builds the React frontend if needed, then starts a single server that serves
BOTH the app and the API at http://localhost:8000 (no separate frontend server).

Usage:
    python run.py                # build if needed, then serve
    python run.py --build        # force a fresh frontend build first
    python run.py --port 9000    # serve on a different port
    python run.py --dev          # skip the build (serve whatever's in dist/)
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Make stdout UTF-8 so status output never crashes on legacy Windows consoles.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
DIST = FRONTEND / "dist"


def _npm() -> str:
    # npm is npm.cmd on Windows.
    for name in ("npm.cmd", "npm"):
        if shutil.which(name):
            return name
    print("[!] npm not found on PATH. Install Node.js 18+ from https://nodejs.org")
    sys.exit(1)


def ensure_frontend(force: bool) -> None:
    if DIST.joinpath("index.html").exists() and not force:
        print("[ok] Frontend already built (frontend/dist).")
        return

    npm = _npm()
    if not FRONTEND.joinpath("node_modules").exists():
        print("- Installing frontend dependencies (first run only)…")
        subprocess.run([npm, "install", "--no-audit", "--no-fund"], cwd=FRONTEND, check=True)

    print("- Building frontend…")
    subprocess.run([npm, "run", "build"], cwd=FRONTEND, check=True)
    print("[ok] Frontend built.")


def serve(port: int) -> None:
    try:
        import uvicorn  # noqa: F401
    except ImportError:
        print("[!] Backend deps missing. Run: pip install -r backend/requirements.txt")
        sys.exit(1)

    os.environ.setdefault("PYTHONPATH", str(ROOT))
    print("\n" + "─" * 52)
    print(f"  Kosh is live ->  http://localhost:{port}")
    print("  All pages + API + live agent feed on this one link.")
    print("─" * 52 + "\n")

    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Kosh as a single server.")
    parser.add_argument("--port", type=int, default=int(os.getenv("BACKEND_PORT", "8000")))
    parser.add_argument("--build", action="store_true", help="force a fresh frontend build")
    parser.add_argument("--dev", action="store_true", help="skip building the frontend")
    args = parser.parse_args()

    if not args.dev:
        ensure_frontend(force=args.build)
    serve(args.port)


if __name__ == "__main__":
    main()
