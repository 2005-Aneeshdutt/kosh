"""RECON AGENT — settlement reconciliation.

Matches uploaded bank-statement rows against Razorpay settlement records by
UTR (exact, then fuzzy) with an amount tolerance, classifies every row, and
produces a natural-language summary.
"""
from __future__ import annotations

import asyncio
from typing import Any, Optional

from backend.agents.bus import emit
from backend.agents.state import MerchantState
from backend.services import invoice_parser, llm

AGENT = "recon"

_AMOUNT_TOLERANCE = 100  # ₹1 in paisa


def _rupees(paisa: int) -> str:
    return f"₹{paisa / 100:,.0f}"


def _levenshtein(a: str, b: str) -> int:
    try:
        import Levenshtein

        return Levenshtein.distance(a, b)
    except Exception:  # pragma: no cover - pure-python fallback
        if a == b:
            return 0
        prev = list(range(len(b) + 1))
        for i, ca in enumerate(a, 1):
            cur = [i]
            for j, cb in enumerate(b, 1):
                cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
            prev = cur
        return prev[-1]


def _find_settlement(utr: str, amount: int, settlements: list[dict]) -> Optional[dict]:
    if not utr:
        return None
    # Exact UTR match first.
    for s in settlements:
        if s.get("matched"):
            continue
        if s["utr"].upper() == utr.upper():
            return s
    # Fuzzy UTR match (Levenshtein <= 2).
    for s in settlements:
        if s.get("matched"):
            continue
        if _levenshtein(s["utr"].upper(), utr.upper()) <= 2:
            return s
    return None


def reconcile(bank_entries: list[dict], settlements: list[dict]) -> dict[str, Any]:
    # Reset match flags for a clean run.
    for s in settlements:
        s["matched"] = False
        s["bank_ref"] = None

    entries: list[dict[str, Any]] = []
    matched = 0
    discrepancies: list[dict] = []
    unmatched_bank: list[dict] = []
    total_matched_amount = 0

    for row in bank_entries:
        utr = row.get("utr") or invoice_parser.extract_utr(row.get("narration", ""))
        bank_amount = row.get("credit", 0) or 0
        settlement = _find_settlement(utr, bank_amount, settlements)

        if settlement is None:
            unmatched_bank.append(row)
            entries.append(
                {
                    "status": "unmatched_bank",
                    "date": row.get("date"),
                    "description": row.get("narration"),
                    "utr": utr,
                    "bank_amount": bank_amount,
                    "razorpay_amount": None,
                }
            )
            continue

        settlement["matched"] = True
        settlement["bank_ref"] = utr
        if abs(settlement["amount"] - bank_amount) <= _AMOUNT_TOLERANCE:
            matched += 1
            total_matched_amount += bank_amount
            status = "matched"
        else:
            discrepancies.append({"utr": utr, "bank": bank_amount, "razorpay": settlement["amount"]})
            status = "discrepancy"
        entries.append(
            {
                "status": status,
                "date": row.get("date"),
                "description": row.get("narration"),
                "utr": utr,
                "bank_amount": bank_amount,
                "razorpay_amount": settlement["amount"],
            }
        )

    unmatched_razorpay = [s for s in settlements if not s.get("matched")]
    for s in unmatched_razorpay:
        entries.append(
            {
                "status": "unmatched_razorpay",
                "date": s.get("created_at", "")[:10],
                "description": f"Razorpay settlement {s['id']}",
                "utr": s["utr"],
                "bank_amount": None,
                "razorpay_amount": s["amount"],
            }
        )

    total_rows = len(bank_entries)
    match_rate = round(matched / total_rows, 4) if total_rows else 0.0

    return {
        "ran": True,
        "total_bank_entries": total_rows,
        "total_settlements": len(settlements),
        "matched": matched,
        "match_rate": match_rate,
        "total_matched_amount": total_matched_amount,
        "discrepancies": discrepancies,
        "unmatched_bank": unmatched_bank,
        "unmatched_razorpay": unmatched_razorpay,
        "entries": entries,
    }


def build_summary(result: dict[str, Any]) -> str:
    unmatched_bank_total = sum((r.get("credit", 0) or 0) for r in result["unmatched_bank"])
    unmatched_rzp_total = sum(s["amount"] for s in result["unmatched_razorpay"])
    prompt = (
        "Summarise this bank-vs-Razorpay reconciliation for an Indian merchant in "
        "2-3 sentences, plain and specific with numbers:\n"
        f"- {result['matched']} of {result['total_bank_entries']} bank rows matched "
        f"({result['match_rate'] * 100:.1f}%).\n"
        f"- {len(result['unmatched_bank'])} bank rows have no matching settlement "
        f"(total {_rupees(unmatched_bank_total)}).\n"
        f"- {len(result['unmatched_razorpay'])} settlements not yet seen in the bank "
        f"(total {_rupees(unmatched_rzp_total)} — likely not credited yet).\n"
        f"- {len(result['discrepancies'])} amount discrepancies.\n"
        "Return only the summary."
    )

    def _fallback() -> str:
        return (
            f"Reconciliation complete. {result['matched']} of {result['total_bank_entries']} "
            f"entries matched ({result['match_rate'] * 100:.1f}%). "
            f"{len(result['unmatched_bank'])} bank rows have no matching Razorpay settlement "
            f"(total {_rupees(unmatched_bank_total)}). "
            f"{len(result['unmatched_razorpay'])} settlements weren't found in your bank statement "
            f"(total {_rupees(unmatched_rzp_total)} — these may not have been credited yet)."
        )

    text, _ = llm.generate(prompt, max_tokens=250, fallback=_fallback)
    return text


async def recon_agent_node(state: MerchantState) -> MerchantState:
    bank_entries = state.get("bank_entries", [])
    settlements = state.get("settlements", [])

    if not bank_entries:
        emit(state, AGENT, "result", "No bank statement uploaded — skipping reconciliation.")
        return {"reconciliation_result": {"ran": False, "summary": "No bank statement uploaded yet."}}

    emit(
        state,
        AGENT,
        "thinking",
        f"Matching {len(bank_entries)} bank rows against {len(settlements)} settlements by UTR…",
    )
    await asyncio.sleep(0.5)

    result = reconcile(bank_entries, settlements)
    emit(
        state,
        AGENT,
        "action",
        f"Matched {result['matched']}/{result['total_bank_entries']} rows "
        f"({result['match_rate'] * 100:.1f}%).",
        {"match_rate": result["match_rate"]},
    )
    await asyncio.sleep(0.3)

    summary = build_summary(result)
    result["summary"] = summary
    emit(state, AGENT, "result", summary)

    return {"reconciliation_result": result, "settlements": settlements}
