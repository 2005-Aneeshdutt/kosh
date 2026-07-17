"""Real-time ledger + Google Sheets sync.

The ledger is a flat, spreadsheet-friendly view of payments, settlements and
invoices. It can be exported as CSV and — when a Google Apps Script Web App URL
is configured — pushed to a live Google Sheet on every change. The Apps Script
snippet is documented in the README.
"""
from __future__ import annotations

import csv
import io
import json
import urllib.request
from datetime import datetime, timezone
from typing import Any

from backend.agents.bus import bus
from backend.services.live_data import live

_CONFIG: dict[str, Any] = {"webhook_url": "", "enabled": False}

LEDGER_HEADER = ["Timestamp", "Type", "Reference", "Party", "Method/UTR", "Amount (INR)", "Status"]


def configure(webhook_url: str | None) -> None:
    _CONFIG["webhook_url"] = (webhook_url or "").strip()
    _CONFIG["enabled"] = bool(_CONFIG["webhook_url"])


def status() -> dict[str, Any]:
    return {"enabled": _CONFIG["enabled"], "webhook_url": _CONFIG["webhook_url"]}


def _rupees(paisa: int) -> str:
    return f"{paisa / 100:,.2f}"


def build_ledger() -> list[dict[str, Any]]:
    """Unified, newest-first ledger across payments, settlements, invoices."""
    rows: list[dict[str, Any]] = []

    for p in live.get_payments()[:120]:
        rows.append(
            {
                "timestamp": p["created_at"],
                "type": "Payment",
                "reference": p["id"],
                "party": p["customer_name"],
                "detail": p["method"].upper(),
                "amount": p["amount"],
                "status": p["status"],
            }
        )
    for s in live.get_settlements():
        rows.append(
            {
                "timestamp": s["created_at"],
                "type": "Settlement",
                "reference": s["id"],
                "party": "Razorpay",
                "detail": s["utr"],
                "amount": s["amount"],
                "status": s["status"],
            }
        )
    for i in live.get_invoices():
        rows.append(
            {
                "timestamp": i.get("paid_at") or i["due_date"],
                "type": "Invoice",
                "reference": i["id"],
                "party": i["customer_name"],
                "detail": i["status"],
                "amount": i["amount"],
                "status": i["status"],
            }
        )

    rows.sort(key=lambda r: r["timestamp"], reverse=True)
    return rows


def to_csv() -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(LEDGER_HEADER)
    for r in build_ledger():
        writer.writerow(
            [r["timestamp"], r["type"], r["reference"], r["party"], r["detail"],
             _rupees(r["amount"]), r["status"]]
        )
    return buf.getvalue()


def push_row(row: dict[str, Any]) -> dict[str, Any]:
    """Push a single ledger row to the configured Google Sheet (best-effort)."""
    if not _CONFIG["enabled"]:
        return {"pushed": False, "reason": "not configured"}
    payload = {
        "row": [
            datetime.now(timezone.utc).isoformat(),
            row.get("type", ""),
            row.get("reference", ""),
            row.get("party", ""),
            row.get("detail", ""),
            _rupees(row.get("amount", 0)),
            row.get("status", ""),
        ]
    }
    try:
        req = urllib.request.Request(
            _CONFIG["webhook_url"],
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=8).read()
        bus.publish_live("sheet_sync", {"reference": row.get("reference"), "ok": True})
        return {"pushed": True}
    except Exception as exc:  # pragma: no cover - network
        return {"pushed": False, "reason": str(exc)}


def push_full() -> dict[str, Any]:
    """Push the entire current ledger (used by the 'Sync now' button)."""
    if not _CONFIG["enabled"]:
        return {"pushed": 0, "reason": "not configured"}
    rows = build_ledger()
    payload = {
        "header": LEDGER_HEADER,
        "rows": [
            [r["timestamp"], r["type"], r["reference"], r["party"], r["detail"],
             _rupees(r["amount"]), r["status"]]
            for r in rows
        ],
        "replace": True,
    }
    try:
        req = urllib.request.Request(
            _CONFIG["webhook_url"],
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        # Apps Script cold-starts and bulk writes can take a while.
        urllib.request.urlopen(req, timeout=90).read()
        bus.publish_live("sheet_sync", {"ok": True, "count": len(rows)})
        return {"pushed": len(rows)}
    except Exception as exc:  # pragma: no cover
        return {"pushed": 0, "reason": str(exc)}
