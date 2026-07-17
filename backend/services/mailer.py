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
    # When set, ALL outbound mail is delivered here instead of the customer's
    # address (handy for demos — every reminder/receipt lands in one real inbox).
    "redirect_to": "",
}


def configure_smtp(**kwargs: Any) -> None:
    _SMTP.update({k: v for k, v in kwargs.items() if v is not None})
    _SMTP["enabled"] = bool(_SMTP.get("host") and _SMTP.get("username"))


def set_redirect(email: str | None) -> None:
    _SMTP["redirect_to"] = (email or "").strip()


def smtp_status() -> dict[str, Any]:
    return {
        "enabled": _SMTP["enabled"],
        "host": _SMTP["host"],
        "port": _SMTP["port"],
        "from_email": _SMTP["from_email"],
        "from_name": _SMTP["from_name"],
        "redirect_to": _SMTP["redirect_to"],
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
            f'<a href="{cta_url}" target="_blank" rel="noopener" '
            f'style="display:inline-block;background:{accent};'
            'color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;'
            'border-radius:10px;font-size:15px;margin:6px 0 4px;">'
            f"{cta_label}</a>"
            f'<div style="margin-top:10px;font-size:11px;color:#94a3b8;">'
            f'Or paste this link: {cta_url}</div>'
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
      <div style="margin-bottom:6px;">
        Payments secured by <span style="color:#3395FF;font-weight:700;">Razorpay</span>
      </div>
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
    # Redirect target wins for actual delivery, so demo emails reach one inbox.
    deliver_to = _SMTP["redirect_to"] or to_email
    if _SMTP["enabled"]:
        try:
            _smtp_send(deliver_to, subject, html)
            delivered = True
        except Exception as exc:  # pragma: no cover - network/credentials
            error = str(exc)

    record = {
        "id": f"mail_{uuid.uuid4().hex[:10]}",
        "kind": kind,
        "to_name": to_name,
        "to_email": to_email,
        "delivered_to": deliver_to,
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


def send_test(to_email: str) -> dict[str, Any]:
    """Send a real test email (or queue it in the outbox if SMTP is off)."""
    html = render_email(
        kind="test",
        to_name="there",
        to_email=to_email,
        subject="✅ Kosh email integration is working",
        body_lines=[
            "This is a test email from your Kosh dashboard.",
            "If you're reading this in your inbox, live SMTP delivery is fully "
            "configured — reminders and payment receipts will be delivered for real.",
            "You can now let the Collect agent chase receivables over email.",
        ],
        cta_label="Open Kosh",
        cta_url="http://localhost:8000",
        accent="#3395FF",
    )
    return send(
        kind="test", to_name="there", to_email=to_email,
        subject="✅ Kosh email integration is working", html=html,
    )


def outbox(limit: int = 50) -> list[dict[str, Any]]:
    return _OUTBOX[:limit]


def get_email(email_id: str) -> Optional[dict[str, Any]]:
    return next((m for m in _OUTBOX if m["id"] == email_id), None)
