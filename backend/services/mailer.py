"""Email integration: an in-app Outbox plus real SMTP delivery when configured.

Every reminder and receipt is rendered as a branded HTML email and stored in
the Outbox (always visible in the UI). If SMTP credentials are configured
(Settings → Integrations), the same email is actually delivered.
"""
from __future__ import annotations

import smtplib
import ssl
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Optional

from backend.agents.bus import bus

# In-memory outbox (newest first).
_OUTBOX: list[dict[str, Any]] = []

# SMTP config set at runtime via the settings router.
_SMTP: dict[str, Any] = {
    "host": "",
    "port": 587,
    "username": "",
    "password": "",
    "from_email": "",
    "from_name": "Artisan Coffee Co.",
    "enabled": False,
}


def configure_smtp(**kwargs: Any) -> None:
    _SMTP.update({k: v for k, v in kwargs.items() if v is not None})
    _SMTP["enabled"] = bool(_SMTP.get("host") and _SMTP.get("username"))


def smtp_status() -> dict[str, Any]:
    return {
        "enabled": _SMTP["enabled"],
        "host": _SMTP["host"],
        "port": _SMTP["port"],
        "from_email": _SMTP["from_email"],
        "from_name": _SMTP["from_name"],
    }


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def render_email(
    *,
    kind: str,
    to_name: str,
    to_email: str,
    subject: str,
    body_lines: list[str],
    cta_label: Optional[str] = None,
    cta_url: Optional[str] = None,
    accent: str = "#3B82F6",
) -> str:
    """Return a branded, self-contained HTML email."""
    paras = "".join(
        f'<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">{ln}</p>'
        for ln in body_lines
    )
    cta = ""
    if cta_label and cta_url:
        cta = (
            f'<a href="{cta_url}" style="display:inline-block;background:{accent};'
            'color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;'
            'border-radius:10px;font-size:15px;margin:6px 0 4px;">'
            f"{cta_label}</a>"
        )
    return f"""\
<div style="background:#f1f5f9;padding:28px 0;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0F172A;padding:20px 28px;color:#fff;">
      <div style="font-size:18px;font-weight:800;letter-spacing:-0.02em;">Artisan Coffee Co.</div>
      <div style="font-size:12px;color:#94a3b8;">Powered by Kosh · Razorpay</div>
    </div>
    <div style="padding:26px 28px;">
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a;">Hi {to_name},</p>
      {paras}
      {cta}
    </div>
    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;">
      Sent to {to_email} · This is an automated message from your AI collections assistant.
    </div>
  </div>
</div>"""


def send(
    *,
    kind: str,
    to_name: str,
    to_email: str,
    subject: str,
    html: str,
    meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Store the email in the outbox and deliver via SMTP if configured."""
    delivered = False
    error: Optional[str] = None
    if _SMTP["enabled"]:
        try:
            _smtp_send(to_email, subject, html)
            delivered = True
        except Exception as exc:  # pragma: no cover - network/credentials
            error = str(exc)

    record = {
        "id": f"mail_{uuid.uuid4().hex[:10]}",
        "kind": kind,
        "to_name": to_name,
        "to_email": to_email,
        "subject": subject,
        "html": html,
        "delivered": delivered,
        "error": error,
        "sent_at": _now(),
        "meta": meta or {},
    }
    _OUTBOX.insert(0, record)
    if len(_OUTBOX) > 200:
        del _OUTBOX[200:]
    bus.publish_live("email", {k: v for k, v in record.items() if k != "html"})
    return record


def _smtp_send(to_email: str, subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f'{_SMTP["from_name"]} <{_SMTP["from_email"] or _SMTP["username"]}>'
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    context = ssl.create_default_context()
    with smtplib.SMTP(_SMTP["host"], int(_SMTP["port"]), timeout=15) as server:
        server.starttls(context=context)
        server.login(_SMTP["username"], _SMTP["password"])
        server.sendmail(_SMTP["from_email"] or _SMTP["username"], [to_email], msg.as_string())


def outbox(limit: int = 50) -> list[dict[str, Any]]:
    return _OUTBOX[:limit]


def get_email(email_id: str) -> Optional[dict[str, Any]]:
    return next((m for m in _OUTBOX if m["id"] == email_id), None)
