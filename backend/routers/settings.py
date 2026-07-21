"""Settings endpoints: manage Razorpay credentials + demo mode."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from backend.config import settings
from backend.models import database
from backend.models.schemas import RazorpayCredentials, RazorpayStatus
from backend.razorpay_client.client import get_client, reset_client
from backend.services import mailer, sheets

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/razorpay/status", response_model=RazorpayStatus)
def razorpay_status() -> RazorpayStatus:
    client = get_client()
    conn = client.test_connection()
    return RazorpayStatus(
        demo_mode=client.demo_mode,
        has_credentials=bool(client.key_id and client.key_secret),
        connected=conn.get("connected", False),
        merchant_name=client.merchant_name,
        llm_enabled=settings.llm_enabled,
        model=settings.active_model,
    )


@router.post("/razorpay", response_model=RazorpayStatus)
def save_razorpay(creds: RazorpayCredentials) -> RazorpayStatus:
    # Persist to the KV store (survives restarts) and rebuild the client.
    database.set_kv("razorpay_key_id", creds.key_id)
    database.set_kv("razorpay_key_secret", creds.key_secret)
    database.set_kv("demo_mode", "true" if creds.demo_mode else "false")

    reset_client(
        demo_mode=creds.demo_mode,
        key_id=creds.key_id or None,
        key_secret=creds.key_secret or None,
    )
    return razorpay_status()


# ── Integrations: SMTP email + Google Sheets ────────────────
class SmtpConfig(BaseModel):
    host: str = ""
    port: int = 587
    username: str = ""
    password: str = ""
    from_email: str = ""
    from_name: str = "Artisan Coffee Co."
    redirect_to: str = ""


class SheetsConfig(BaseModel):
    webhook_url: str = ""


class TestEmailRequest(BaseModel):
    to_email: str = "aneeshdutt67@gmail.com"


@router.get("/integrations")
def integrations_status() -> dict:
    return {"smtp": mailer.smtp_status(), "sheets": sheets.status()}


@router.post("/integrations/smtp")
def save_smtp(cfg: SmtpConfig) -> dict:
    payload = cfg.model_dump()
    redirect = payload.pop("redirect_to", "")
    mailer.configure_smtp(**payload)
    mailer.set_redirect(redirect)
    return mailer.smtp_status()


@router.post("/integrations/sheets")
def save_sheets(cfg: SheetsConfig) -> dict:
    sheets.configure(cfg.webhook_url)
    return sheets.status()


@router.post("/integrations/test-email")
def send_test_email(req: TestEmailRequest) -> dict:
    rec = mailer.send_test(req.to_email)
    return {
        "delivered": rec["delivered"],
        "delivered_to": rec.get("delivered_to"),
        "error": rec.get("error"),
        "smtp_enabled": mailer.smtp_status()["enabled"],
    }
