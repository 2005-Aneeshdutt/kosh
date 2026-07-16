"""Tiny SQLite layer for persisting agent runs, events, and settings overrides.

Kept intentionally simple: a single synchronous connection helper plus a few
CRUD functions. This is a demo store, not a production database.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator, Optional

from backend.config import settings


@contextmanager
def _conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(settings.sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with _conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS agent_runs (
                run_id      TEXT PRIMARY KEY,
                started_at  TEXT NOT NULL,
                finished_at TEXT,
                status      TEXT NOT NULL,
                summary     TEXT
            );

            CREATE TABLE IF NOT EXISTS agent_events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id      TEXT,
                agent_name  TEXT NOT NULL,
                event_type  TEXT NOT NULL,
                message     TEXT NOT NULL,
                metadata    TEXT,
                timestamp   TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings_kv (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Agent runs ──────────────────────────────────────────────
def create_run(run_id: str) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO agent_runs (run_id, started_at, status) VALUES (?, ?, ?)",
            (run_id, _now(), "running"),
        )


def finish_run(run_id: str, status: str, summary: str) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE agent_runs SET finished_at = ?, status = ?, summary = ? WHERE run_id = ?",
            (_now(), status, summary, run_id),
        )


def record_event(
    agent_name: str,
    event_type: str,
    message: str,
    metadata: Optional[dict[str, Any]] = None,
    run_id: Optional[str] = None,
) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO agent_events (run_id, agent_name, event_type, message, metadata, timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                run_id,
                agent_name,
                event_type,
                message,
                json.dumps(metadata) if metadata else None,
                _now(),
            ),
        )


# ── Settings overrides (persisted across restarts) ──────────
def set_kv(key: str, value: str) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO settings_kv (key, value) VALUES (?, ?)",
            (key, value),
        )


def get_kv(key: str) -> Optional[str]:
    with _conn() as conn:
        row = conn.execute("SELECT value FROM settings_kv WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else None
