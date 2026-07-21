"""Lightweight retrieval over the merchant's own data — "Ask your books".

Builds a corpus of short documents from live payments, invoices, and
settlements and retrieves the most relevant ones for a natural-language query
using TF-weighted term overlap. No embeddings and no network call, so retrieval
is instant and works fully offline; an optional LLM then phrases a grounded
answer over the retrieved context (true RAG, with citations).
"""
from __future__ import annotations

import math
import re
from collections import Counter
from datetime import datetime
from typing import Any

from backend.services.live_data import live

_STOP = {
    "the", "a", "an", "of", "to", "in", "on", "for", "is", "are", "was", "were",
    "how", "much", "many", "did", "do", "does", "what", "when", "who", "and",
    "me", "my", "our", "we", "i", "show", "tell", "list", "from", "by", "with",
    "has", "have", "had", "this", "that", "get", "give", "paid", "pay",
}

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7,
    "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _rupees(paisa: int) -> str:
    return f"₹{paisa / 100:,.0f}"


_MONTH_NAMES = ["", "january", "february", "march", "april", "may", "june",
                "july", "august", "september", "october", "november", "december"]


def _tok(text: str) -> list[str]:
    toks: list[str] = []
    for t in re.findall(r"[a-z0-9]+", text.lower()):
        if t in _STOP or len(t) <= 1:
            continue
        toks.append(t)
        # crude singular so "settlements"/"payments"/"invoices" match the corpus
        if len(t) > 4 and t.endswith("s"):
            toks.append(t[:-1])
    return toks


def _month_word(date_str: str) -> str:
    try:
        return _MONTH_NAMES[datetime.strptime(date_str, "%Y-%m-%d").month]
    except (ValueError, TypeError):
        return ""


def build_corpus() -> list[dict[str, Any]]:
    """Return retrievable documents, each with text + a source citation."""
    docs: list[dict[str, Any]] = []

    for p in live.get_payments()[:200]:
        d = p["created_at"][:10]
        status = p["status"]
        docs.append(
            {
                "text": f"Payment {p['id']} {p['customer_name']} {_rupees(p['amount'])} "
                        f"via {p['method']} {status} on {d} {_month_word(d)}",
                "ref": p["id"],
                "kind": "Payment",
                "label": f"{p['customer_name']} · {_rupees(p['amount'])} · {status}",
                "date": d,
                "amount": p["amount"],
            }
        )
    for i in live.get_invoices():
        d = (i.get("paid_at") or i["due_date"])[:10]
        docs.append(
            {
                "text": f"Invoice {i['id']} {i['customer_name']} {_rupees(i['amount'])} "
                        f"{i['status']} due {i['due_date'][:10]}",
                "ref": i["id"],
                "kind": "Invoice",
                "label": f"{i['id']} · {i['customer_name']} · {i['status']}",
                "date": d,
                "amount": i["amount"],
            }
        )
    for s in live.get_settlements():
        d = s["created_at"][:10]
        docs.append(
            {
                "text": f"Settlement {s['id']} Razorpay {_rupees(s['amount'])} UTR {s['utr']} on {d} {_month_word(d)}",
                "ref": s["id"],
                "kind": "Settlement",
                "label": f"{s['id']} · {_rupees(s['amount'])}",
                "date": d,
                "amount": s["amount"],
            }
        )
    return docs


def retrieve(query: str, k: int = 6) -> list[dict[str, Any]]:
    """Return the top-k documents most relevant to the query."""
    corpus = build_corpus()
    q_terms = Counter(_tok(query))
    if not q_terms:
        return []

    # Document frequency for IDF weighting.
    df: Counter = Counter()
    doc_tokens: list[list[str]] = []
    for doc in corpus:
        toks = _tok(doc["text"])
        doc_tokens.append(toks)
        for t in set(toks):
            df[t] += 1
    n = len(corpus) or 1

    scored: list[tuple[float, dict]] = []
    for doc, toks in zip(corpus, doc_tokens):
        tf = Counter(toks)
        score = 0.0
        for term, qn in q_terms.items():
            if term in tf:
                idf = math.log((n + 1) / (df[term] + 1)) + 1
                score += qn * tf[term] * idf
        if score > 0:
            scored.append((score, doc))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [d for _, d in scored[:k]]


def aggregate(query: str, docs: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Best-effort numeric aggregation for 'how much / total' questions."""
    if not docs:
        return None
    low = query.lower()
    wants_total = any(w in low for w in ["how much", "total", "sum", "combined"])
    if not wants_total:
        return None

    # Optional month filter.
    month = next((m for name, m in _MONTHS.items() if name in low), None)
    filtered = docs
    if month:
        filtered = [d for d in docs if _month_of(d["date"]) == month]
    total = sum(d["amount"] for d in filtered)
    return {"total": total, "count": len(filtered), "month": month}


def _month_of(date_str: str) -> int | None:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").month
    except (ValueError, TypeError):
        return None
