"""Realistic Indian-merchant mock data for Kosh's demo mode.

The dataset tells a deliberate story that the four agents discover on their own:
  * A handful of overdue B2B invoices, including a large one from
    "Bangalore Brew House" that jeopardises Friday payroll.
  * A UPI success-rate dip on the afternoon of day 3 (the Pulse anomaly).
  * A projected Thursday cash crunch (the Oracle alert).
  * A bank statement that mostly matches settlements, with a few
    intentional unmatched / discrepant rows for the Recon agent.

Everything is generated deterministically from a fixed seed so the demo looks
identical on every run.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Any

SEED = 20260716
MERCHANT_ID = "acc_ArtisanCoffeeCo"
MERCHANT_NAME = "Artisan Coffee Co."

_FIRST_NAMES = [
    "Priya", "Rahul", "Ankit", "Sneha", "Vikram", "Meera", "Arjun", "Kavitha",
    "Rohan", "Divya", "Karthik", "Nisha", "Aditya", "Pooja", "Sanjay", "Ananya",
    "Manish", "Ritu", "Vivek", "Lakshmi", "Farhan", "Isha", "Naveen", "Tara",
]
_LAST_NAMES = [
    "Sharma", "Iyer", "Reddy", "Nair", "Gupta", "Menon", "Rao", "Patel",
    "Bose", "Khan", "Desai", "Pillai", "Verma", "Joshi", "Kulkarni",
]

_WHOLESALE_CUSTOMERS = [
    ("Bangalore Brew House", "orders@bangalorebrew.in", "+919845012345"),
    ("Morning Mist Cafe", "accounts@morningmist.co.in", "+919845023456"),
    ("The Filter Room", "hello@filterroom.in", "+919845034567"),
    ("South Grounds", "buy@southgrounds.in", "+919845045678"),
    ("Cardamom & Co.", "finance@cardamomandco.in", "+919845056789"),
    ("Terrace Roasters", "ap@terraceroasters.in", "+919845067890"),
    ("Bean Theory", "invoices@beantheory.in", "+919845078901"),
    ("Kaapi Culture", "pay@kaapiculture.in", "+919845089012"),
    ("Peak Perk Cafe", "accounts@peakperk.in", "+919845090123"),
    ("Highland Sips", "orders@highlandsips.in", "+919845101234"),
]

_METHODS = ["upi", "upi", "upi", "card", "netbanking", "wallet"]
_FAILURE_REASONS = ["bank_timeout", "insufficient_funds", "user_cancelled", "bank_refused"]


def _rng() -> random.Random:
    return random.Random(SEED)


def _now() -> datetime:
    return datetime(2026, 7, 16, 15, 30, tzinfo=timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _customer_name(rng: random.Random) -> str:
    return f"{rng.choice(_FIRST_NAMES)} {rng.choice(_LAST_NAMES)}"


# ── Payments (last 30 days) ─────────────────────────────────
def generate_payments() -> list[dict[str, Any]]:
    rng = _rng()
    now = _now()
    payments: list[dict[str, Any]] = []

    for i in range(200):
        # Spread payments across 30 days, biased toward business hours.
        days_ago = rng.randint(0, 29)
        hour = rng.choices(
            population=list(range(24)),
            weights=[1, 1, 1, 1, 1, 1, 2, 4, 6, 9, 12, 12, 11, 8, 6, 5, 5, 6, 9, 11, 9, 6, 3, 2],
        )[0]
        created = now - timedelta(days=days_ago, hours=now.hour - hour, minutes=rng.randint(0, 59))

        method = rng.choice(_METHODS)
        amount = rng.choice([29900, 49900, 79900, 99900, 149900, 249900, 349900, 499900])

        # Baseline ~94% capture rate.
        roll = rng.random()
        status = "captured"
        failure_reason = None
        if roll > 0.96:
            status = "refunded"
        elif roll > 0.94:
            status = "failed"
            failure_reason = rng.choice(_FAILURE_REASONS)

        # Baked anomaly: UPI dip on the afternoon of "day 3" (~3 days ago, 13:00-17:00).
        if method == "upi" and days_ago == 3 and 13 <= hour <= 17 and rng.random() > 0.45:
            status = "failed"
            failure_reason = "bank_timeout"

        payments.append(
            {
                "id": f"pay_{SEED}{i:04d}",
                "customer_name": _customer_name(rng),
                "amount": amount,
                "method": method,
                "status": status,
                "created_at": _iso(created),
                "failure_reason": failure_reason,
            }
        )

    payments.sort(key=lambda p: p["created_at"], reverse=True)
    return payments


# ── Invoices (B2B / wholesale) ──────────────────────────────
def generate_invoices() -> list[dict[str, Any]]:
    rng = _rng()
    now = _now()
    invoices: list[dict[str, Any]] = []

    # 20 paid, 6 overdue, 4 pending (not yet due) = 30 total.
    plan = (
        [("paid", None)] * 20
        + [("overdue", d) for d in (3, 8, 14, 22, 35, 45)]
        + [("pending", d) for d in (-4, -7, -11, -15)]  # negative == due in future
    )

    for i, (status, offset) in enumerate(plan):
        customer = _WHOLESALE_CUSTOMERS[i % len(_WHOLESALE_CUSTOMERS)]
        amount = rng.choice([1500000, 3500000, 5000000, 7500000, 12000000, 18000000, 25000000])

        if status == "overdue":
            days_overdue = offset
            due = now - timedelta(days=days_overdue)
            reminders = min(3, days_overdue // 12)
        elif status == "pending":
            days_overdue = 0
            due = now - timedelta(days=offset)  # offset negative -> future date
            reminders = 0
        else:  # paid
            days_overdue = 0
            due = now - timedelta(days=rng.randint(20, 60))
            reminders = 0

        # The headline problem invoice.
        if i == 20:  # first overdue -> Bangalore Brew House, big and 3 days over.
            customer = _WHOLESALE_CUSTOMERS[0]
            amount = 12000000  # ₹1,20,000

        last_reminder = None
        if reminders > 0:
            last_reminder = _iso(now - timedelta(days=rng.randint(1, 5)))

        invoices.append(
            {
                "id": f"INV-{1000 + i}",
                "customer_name": customer[0],
                "customer_email": customer[1],
                "customer_phone": customer[2],
                "amount": amount,
                "due_date": _iso(due),
                "status": status,
                "days_overdue": days_overdue,
                "payment_link_id": None,
                "payment_link_url": None,
                "reminders_sent": reminders,
                "last_reminder_date": last_reminder,
                "risk_score": 0.0,
            }
        )

    return invoices


# ── Settlements (T+2) ───────────────────────────────────────
def generate_settlements() -> list[dict[str, Any]]:
    rng = _rng()
    now = _now()
    settlements: list[dict[str, Any]] = []

    for i in range(25):
        days_ago = 2 + i  # roughly one settlement per day, T+2 cycle
        created = now - timedelta(days=days_ago)
        amount = rng.choice([2000000, 4500000, 6800000, 9200000, 11500000, 14000000, 18000000])
        utr = f"UTIB{created.strftime('%Y%m%d')}{rng.randint(100000, 999999)}"
        settlements.append(
            {
                "id": f"setl_{SEED}{i:03d}",
                "amount": amount,
                "utr": utr,
                "status": "processed",
                "created_at": _iso(created),
                "matched": False,
                "bank_ref": None,
            }
        )

    settlements.sort(key=lambda s: s["created_at"], reverse=True)
    return settlements


# ── Bank statement rows (matched to settlements + intentional mismatches) ──
def generate_bank_entries() -> list[dict[str, Any]]:
    """Return parsed bank-statement rows aligned to settlements.

    Story: most settlements appear verbatim; two settlements are *missing*
    from the bank (not yet credited); three bank rows have no matching
    settlement (other inflows); one row has a small amount discrepancy.
    """
    settlements = generate_settlements()
    rng = random.Random(SEED + 1)
    rows: list[dict[str, Any]] = []
    balance = 45_00_000  # ₹45,00,000 opening (paisa)

    # Bring in most settlements as bank credits.
    for idx, s in enumerate(settlements):
        if idx in (2, 5):
            continue  # these two settlements are NOT yet in the bank
        credit = s["amount"]
        if idx == 7:
            credit = s["amount"] - 100  # ₹1 discrepancy
        balance += credit
        rows.append(
            {
                "date": s["created_at"][:10],
                "narration": f"NEFT CR RAZORPAY {s['utr']} SETTLEMENT",
                "debit": 0,
                "credit": credit,
                "balance": balance,
            }
        )

    # Three unmatched bank inflows (not from Razorpay).
    now = _now()
    for j, (label, amt) in enumerate(
        [("UPI CR SWIGGY VENDOR PAYOUT", 1850000),
         ("NEFT CR WHOLESALE ADVANCE HIGHLANDSIPS", 900000),
         ("IMPS CR CATERING EVENT DEPOSIT", 600000)]
    ):
        balance += amt
        rows.append(
            {
                "date": (now - timedelta(days=1 + j)).strftime("%Y-%m-%d"),
                "narration": label,
                "debit": 0,
                "credit": amt,
                "balance": balance,
            }
        )

    rows.sort(key=lambda r: r["date"], reverse=True)
    return rows


def sample_bank_statement_csv() -> str:
    """CSV rendering of the bank statement for the seed sample file / uploads."""
    rows = generate_bank_entries()
    lines = ["Date,Narration,Debit,Credit,Balance"]
    for r in rows:
        debit = "" if not r["debit"] else f"{r['debit'] / 100:.2f}"
        credit = "" if not r["credit"] else f"{r['credit'] / 100:.2f}"
        lines.append(
            f'{r["date"]},"{r["narration"]}",{debit},{credit},{r["balance"] / 100:.2f}'
        )
    return "\n".join(lines) + "\n"


# ── Payment metrics (hourly, last 7 days) ───────────────────
def generate_payment_metrics() -> list[dict[str, Any]]:
    payments = generate_payments()
    now = _now()
    # Bucket captured/failed payments per calendar day for the last 7 days.
    metrics: list[dict[str, Any]] = []
    for days_ago in range(6, -1, -1):
        day = (now - timedelta(days=days_ago)).date()
        day_payments = [
            p for p in payments
            if datetime.fromisoformat(p["created_at"]).date() == day
        ]
        if not day_payments:
            continue
        successful = sum(1 for p in day_payments if p["status"] == "captured")
        failed = sum(1 for p in day_payments if p["status"] == "failed")
        total = len(day_payments)
        method_breakdown: dict[str, int] = {}
        for p in day_payments:
            method_breakdown[p["method"]] = method_breakdown.get(p["method"], 0) + 1
        avg_amount = sum(p["amount"] for p in day_payments) / total if total else 0
        metrics.append(
            {
                "timestamp": _iso(datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)),
                "total_payments": total,
                "successful": successful,
                "failed": failed,
                "success_rate": round(successful / total, 4) if total else 0.0,
                "avg_amount": round(avg_amount, 2),
                "method_breakdown": method_breakdown,
            }
        )
    return metrics
