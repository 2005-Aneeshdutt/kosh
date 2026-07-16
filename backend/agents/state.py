"""Shared LangGraph state for the Kosh agent crew."""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional, TypedDict


class PaymentStatus(str, Enum):
    CAPTURED = "captured"
    FAILED = "failed"
    REFUNDED = "refunded"
    AUTHORIZED = "authorized"


class DebtorRisk(str, Enum):
    LOW = "low"           # Will likely pay on time
    MEDIUM = "medium"     # Needs a nudge
    HIGH = "high"         # Chronic late payer
    CRITICAL = "critical"  # 90+ days overdue


class Invoice(TypedDict):
    id: str
    customer_name: str
    customer_email: str
    customer_phone: str
    amount: int                    # in paisa
    due_date: str                  # ISO format
    status: str                    # pending | paid | overdue | partially_paid
    days_overdue: int
    payment_link_id: Optional[str]
    payment_link_url: Optional[str]
    reminders_sent: int
    last_reminder_date: Optional[str]
    risk_score: float              # 0.0 to 1.0 (1.0 = highest risk)


class Settlement(TypedDict):
    id: str
    amount: int
    utr: str
    status: str
    created_at: str
    matched: bool
    bank_ref: Optional[str]


class PaymentMetric(TypedDict):
    timestamp: str
    total_payments: int
    successful: int
    failed: int
    success_rate: float
    avg_amount: float
    method_breakdown: Dict[str, int]


class CashflowForecast(TypedDict):
    date: str
    predicted_inflow: float
    predicted_outflow: float
    net_position: float
    confidence: float


class AgentEvent(TypedDict):
    agent_name: str                # collect | recon | oracle | pulse | orchestrator
    event_type: str                # thinking | action | result | error
    message: str
    timestamp: str
    metadata: Optional[Dict[str, Any]]


class MerchantState(TypedDict, total=False):
    # Merchant identity
    merchant_id: str
    merchant_name: str
    razorpay_connected: bool

    # Core data
    invoices: List[Invoice]
    settlements: List[Settlement]
    recent_payments: List[Dict[str, Any]]
    payment_metrics: List[PaymentMetric]

    # Agent outputs
    collection_actions: List[Dict[str, Any]]
    reconciliation_result: Optional[Dict[str, Any]]
    cashflow_forecast: List[CashflowForecast]
    cashflow_alerts: List[Dict[str, Any]]
    anomalies: List[Dict[str, Any]]
    payment_health: Optional[Dict[str, Any]]
    payment_insights: List[str]

    # Activity log for the frontend feed
    agent_events: List[AgentEvent]

    # Uploaded bank statement rows
    bank_entries: List[Dict[str, Any]]

    # Run metadata
    run_id: Optional[str]
    last_run: Optional[str]
    summary: Optional[str]
    errors: List[str]
