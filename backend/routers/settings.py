"""Settings endpoints: manage Razorpay credentials + demo mode."""
from __future__ import annotations

from fastapi import APIRouter

from backend.config import settings
from backend.models import database
from backend.models.schemas import RazorpayCredentials, RazorpayStatus
from backend.razorpay_client.client import get_client, reset_client

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
        model=settings.model,
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
