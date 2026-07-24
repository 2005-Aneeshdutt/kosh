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

            CREATE TABLE IF NOT EXISTS audit_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                ts          TEXT NOT NULL,
                actor_type  TEXT NOT NULL,   -- agent | human | system
                actor       TEXT NOT NULL,
                action      TEXT NOT NULL,
                target      TEXT,
                detail      TEXT,
                amount      INTEGER,
                metadata    TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log (id DESC);
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


# ── Audit log (immutable activity trail) ────────────────────
def record_audit(
    actor_type: str,
    actor: str,
    action: str,
    target: Optional[str] = None,
    detail: Optional[str] = None,
    amount: Optional[int] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO audit_log (ts, actor_type, actor, action, target, detail, amount, metadata) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                _now(),
                actor_type,
                actor,
                action,
                target,
                detail,
                amount,
                json.dumps(metadata) if metadata else None,
            ),
        )


def query_audit(
    limit: int = 100,
    actor_type: Optional[str] = None,
    action_prefix: Optional[str] = None,
) -> list[dict[str, Any]]:
    clauses, params = [], []
    if actor_type and actor_type != "all":
        clauses.append("actor_type = ?")
        params.append(actor_type)
    if action_prefix:
        clauses.append("action LIKE ?")
        params.append(f"{action_prefix}%")
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(limit)
    with _conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM audit_log {where} ORDER BY id DESC LIMIT ?", params
        ).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        d["metadata"] = json.loads(d["metadata"]) if d.get("metadata") else None
        out.append(d)
    return out


def audit_summary() -> dict[str, int]:
    with _conn() as conn:
        total = conn.execute("SELECT COUNT(*) AS c FROM audit_log").fetchone()["c"]
        by_type = conn.execute(
            "SELECT actor_type, COUNT(*) AS c FROM audit_log GROUP BY actor_type"
        ).fetchall()
    summary = {"total": total, "agent": 0, "human": 0, "system": 0}
    for r in by_type:
        summary[r["actor_type"]] = r["c"]
    return summary


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
