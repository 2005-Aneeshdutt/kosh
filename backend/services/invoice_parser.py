"""Bank-statement parsing for reconciliation (CSV + PDF).

Handles common Indian bank-statement layouts:
  * CSV columns like Date, Description/Narration, Debit, Credit, Balance
  * DD/MM/YYYY and YYYY-MM-DD dates
  * Indian number formatting (1,00,000)
  * UTR/NEFT/IMPS reference numbers embedded in the narration text
"""
from __future__ import annotations

import csv
import io
import re
from typing import Any

# UTR-like tokens: 4 letters + 10-16 digits (e.g. UTIB2026071600001234), and
# common transfer-mode prefixes.
_UTR_PATTERNS = [
    re.compile(r"\b([A-Z]{4}\d{10,16})\b"),
    re.compile(r"UTR[:\s]*([A-Za-z0-9]{8,})"),
    re.compile(r"NEFT[:\s]*([A-Za-z0-9]{8,})"),
    re.compile(r"IMPS[:\s]*([A-Za-z0-9]{8,})"),
]

_DATE_COLS = {"date", "txn date", "transaction date", "value date"}
_DESC_COLS = {"narration", "description", "particulars", "remarks", "details"}
_DEBIT_COLS = {"debit", "withdrawal", "withdrawal amt", "dr"}
_CREDIT_COLS = {"credit", "deposit", "deposit amt", "cr"}
_BALANCE_COLS = {"balance", "closing balance"}


def extract_utr(text: str) -> str | None:
    if not text:
        return None
    upper = text.upper()
    for pat in _UTR_PATTERNS:
        m = pat.search(upper)
        if m:
            return m.group(1).upper()
    return None


def _to_paisa(raw: str) -> int:
    if raw is None:
        return 0
    cleaned = str(raw).replace(",", "").replace("₹", "").strip()
    if not cleaned:
        return 0
    try:
        return int(round(float(cleaned) * 100))
    except ValueError:
        return 0


def _norm_date(raw: str) -> str:
    raw = (raw or "").strip()
    # DD/MM/YYYY or DD-MM-YYYY -> YYYY-MM-DD
    m = re.match(r"(\d{2})[/-](\d{2})[/-](\d{4})", raw)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{mo}-{d}"
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", raw)
    if m:
        return m.group(0)
    return raw


def _match_col(header_row: list[str], candidates: set[str]) -> int | None:
    for i, col in enumerate(header_row):
        if col.strip().lower() in candidates:
            return i
    return None


def parse_csv(content: str) -> list[dict[str, Any]]:
    reader = list(csv.reader(io.StringIO(content)))
    if not reader:
        return []

    header = [c.strip().lower() for c in reader[0]]
    di = _match_col(header, _DATE_COLS)
    desc_i = _match_col(header, _DESC_COLS)
    debit_i = _match_col(header, _DEBIT_COLS)
    credit_i = _match_col(header, _CREDIT_COLS)
    bal_i = _match_col(header, _BALANCE_COLS)

    rows: list[dict[str, Any]] = []
    for raw_row in reader[1:]:
        if not any(cell.strip() for cell in raw_row):
            continue
        narration = raw_row[desc_i] if desc_i is not None and desc_i < len(raw_row) else ""
        rows.append(
            {
                "date": _norm_date(raw_row[di]) if di is not None and di < len(raw_row) else "",
                "narration": narration.strip(),
                "debit": _to_paisa(raw_row[debit_i]) if debit_i is not None and debit_i < len(raw_row) else 0,
                "credit": _to_paisa(raw_row[credit_i]) if credit_i is not None and credit_i < len(raw_row) else 0,
                "balance": _to_paisa(raw_row[bal_i]) if bal_i is not None and bal_i < len(raw_row) else 0,
                "utr": extract_utr(narration),
            }
        )
    return rows


def parse_pdf(content: bytes) -> list[dict[str, Any]]:
    try:
        import pdfplumber
    except ImportError:  # pragma: no cover
        return []

    rows: list[dict[str, Any]] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                if not table or len(table) < 2:
                    continue
                # Re-serialise the table to CSV and reuse the CSV parser.
                buf = io.StringIO()
                writer = csv.writer(buf)
                for r in table:
                    writer.writerow([("" if c is None else c) for c in r])
                rows.extend(parse_csv(buf.getvalue()))
    return rows


def parse_statement(filename: str, content: bytes) -> list[dict[str, Any]]:
    """Dispatch on file extension; return normalised bank rows."""
    name = filename.lower()
    if name.endswith(".pdf"):
        return parse_pdf(content)
    text = content.decode("utf-8", errors="replace")
    return parse_csv(text)
