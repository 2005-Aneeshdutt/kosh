"""Pydantic models for API requests and responses."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


# ── Dashboard ───────────────────────────────────────────────
class TrendPoint(BaseModel):
    label: str
    value: float


class MetricCard(BaseModel):
    key: str
    label: str
    value: float
    display: str
    trend_pct: float
    trend_direction: str  # "up" | "down" | "flat"
    sparkline: list[float]


class DashboardMetrics(BaseModel):
    merchant_name: str
    generated_at: str
    cards: list[MetricCard]


class ARAgingBucket(BaseModel):
    bucket: str  # "0-30" | "30-60" | "60-90" | "90+"
    amount: int  # paisa
    count: int


class ARAgingResponse(BaseModel):
    buckets: list[ARAgingBucket]
    total_outstanding: int


class PaymentRow(BaseModel):
    id: str
    customer_name: str
    amount: int
    method: str
    status: str
    created_at: str
    failure_reason: Optional[str] = None


# ── Collections ─────────────────────────────────────────────
class DebtorRow(BaseModel):
    id: str
    customer_name: str
    customer_email: str
    customer_phone: str
    amount: int
    due_date: str
    days_overdue: int
    status: str
    risk_score: float
    risk_band: str
    reminders_sent: int
    last_reminder_date: Optional[str] = None
    payment_link_url: Optional[str] = None


class SendReminderRequest(BaseModel):
    invoice_id: str


class SendReminderResponse(BaseModel):
    invoice_id: str
    message: str
    payment_link_url: Optional[str] = None
    reminders_sent: int
    tone: str


# ── Reconciliation ──────────────────────────────────────────
class ReconEntry(BaseModel):
    status: str  # matched | discrepancy | unmatched_bank | unmatched_razorpay
    date: Optional[str] = None
    description: Optional[str] = None
    utr: Optional[str] = None
    bank_amount: Optional[int] = None
    razorpay_amount: Optional[int] = None


class ReconResult(BaseModel):
    ran: bool
    summary: str
    total_bank_entries: int
    total_settlements: int
    matched: int
    match_rate: float
    total_matched_amount: int
    entries: list[ReconEntry]


class UploadResponse(BaseModel):
    filename: str
    rows_parsed: int
    recon: ReconResult


# ── Forecast ────────────────────────────────────────────────
class ForecastDay(BaseModel):
    date: str
    predicted_inflow: float
    predicted_outflow: float
    net_position: float
    confidence: float
    is_history: bool


class ForecastAlert(BaseModel):
    severity: str  # info | warning | critical
    message: str


class ForecastResponse(BaseModel):
    days: list[ForecastDay]
    alerts: list[ForecastAlert]


# ── Agents ──────────────────────────────────────────────────
class AgentStatus(BaseModel):
    name: str
    label: str
    status: str  # idle | active | done | error
    last_run: Optional[str] = None
    summary: Optional[str] = None
    actions_taken: int = 0


class AgentEventModel(BaseModel):
    agent_name: str
    event_type: str
    message: str
    timestamp: str
    metadata: Optional[dict[str, Any]] = None


class RunAgentsResponse(BaseModel):
    started: bool
    run_id: str


# ── Settings ────────────────────────────────────────────────
class RazorpayCredentials(BaseModel):
    key_id: str
    key_secret: str
    demo_mode: bool = True


class RazorpayStatus(BaseModel):
    demo_mode: bool
    has_credentials: bool
    connected: bool
    merchant_name: str
    llm_enabled: bool
    model: str
