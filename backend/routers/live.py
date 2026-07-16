"""Live product surface: real-time stream, checkout, ledger, mail, simulator."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from backend.agents.bus import bus
from backend.services import mailer, payments, sheets
from backend.services.live_data import live
from backend.services.simulator import simulator

router = APIRouter(prefix="/api", tags=["live"])


# ── Real-time stream ────────────────────────────────────────
@router.get("/stream")
async def stream():
    """SSE stream of live business events (payments, invoices, emails, metrics)."""

    async def gen():
        q = bus.subscribe_live()
        try:
            for ev in bus.recent_live(15):
                yield {"event": "live", "data": json.dumps(ev)}
            while True:
                ev = await q.get()
                yield {"event": "live", "data": json.dumps(ev)}
        finally:
            bus.unsubscribe_live(q)

    return EventSourceResponse(gen())


# ── Checkout (Razorpay-style) ───────────────────────────────
@router.get("/pay/{invoice_id}")
def pay_info(invoice_id: str) -> dict:
    inv = live.get_invoice(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Payment link not found")
    return {
        "invoice_id": inv["id"],
        "merchant_name": live.merchant_name,
        "amount": inv["amount"],
        "currency": "INR",
        "customer_name": inv["customer_name"],
        "customer_email": inv["customer_email"],
        "status": inv["status"],
        "description": f"Payment for Invoice #{inv['id']}",
    }


class OrderRequest(BaseModel):
    invoice_id: str


@router.post("/checkout/order")
def create_order(req: OrderRequest) -> dict:
    try:
        return payments.create_order(req.invoice_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class PayRequest(BaseModel):
    invoice_id: str
    method: str  # card | upi | netbanking
    card_number: str | None = None
    card_expiry: str | None = None
    card_cvv: str | None = None
    card_name: str | None = None
    vpa: str | None = None
    bank: str | None = None


@router.post("/checkout/pay")
def checkout_pay(req: PayRequest) -> dict:
    try:
        return payments.process_invoice_payment(
            req.invoice_id,
            req.method,
            {
                "card_number": req.card_number,
                "card_expiry": req.card_expiry,
                "card_cvv": req.card_cvv,
                "card_name": req.card_name,
                "vpa": req.vpa,
                "bank": req.bank,
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Simulator ───────────────────────────────────────────────
@router.post("/simulator/{action}")
def simulator_control(action: str) -> dict:
    if action == "start":
        simulator.start()
    elif action == "stop":
        simulator.stop()
    elif action == "tick":
        return {"payment": live.random_live_payment(), **simulator.status()}
    else:
        raise HTTPException(status_code=400, detail="Unknown action")
    return simulator.status()


@router.get("/simulator/status")
def simulator_status() -> dict:
    return simulator.status()


# ── Ledger + Sheets ─────────────────────────────────────────
@router.get("/ledger")
def ledger() -> dict:
    return {"header": sheets.LEDGER_HEADER, "rows": sheets.build_ledger()}


@router.get("/ledger/export.csv")
def ledger_csv() -> PlainTextResponse:
    return PlainTextResponse(
        sheets.to_csv(),
        headers={"Content-Disposition": "attachment; filename=kosh_ledger.csv"},
        media_type="text/csv",
    )


@router.post("/ledger/sync")
def ledger_sync() -> dict:
    return sheets.push_full()


# ── Mail outbox ─────────────────────────────────────────────
@router.get("/mail/outbox")
def mail_outbox() -> dict:
    return {"emails": [{k: v for k, v in m.items() if k != "html"} for m in mailer.outbox()]}


@router.get("/mail/{email_id}")
def mail_detail(email_id: str) -> dict:
    m = mailer.get_email(email_id)
    if not m:
        raise HTTPException(status_code=404, detail="Email not found")
    return m
