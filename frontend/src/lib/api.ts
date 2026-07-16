// Typed API client + SSE sources for the Kosh backend.

export interface MetricCard {
  key: string;
  label: string;
  value: number;
  display: string;
  trend_pct: number;
  trend_direction: "up" | "down" | "flat";
  sparkline: number[];
}
export interface DashboardMetrics {
  merchant_name: string;
  generated_at: string;
  cards: MetricCard[];
}
export interface ARAgingBucket { bucket: string; amount: number; count: number }
export interface ARAgingResponse { buckets: ARAgingBucket[]; total_outstanding: number }
export interface PaymentRow {
  id: string;
  customer_name: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
  failure_reason?: string | null;
  source?: string | null;
}
export interface DebtorRow {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  amount: number;
  due_date: string;
  days_overdue: number;
  status: string;
  risk_score: number;
  risk_band: string;
  reminders_sent: number;
  last_reminder_date?: string | null;
  payment_link_url?: string | null;
}
export interface ReminderResponse {
  invoice_id: string;
  message: string;
  payment_link_url?: string | null;
  reminders_sent: number;
  tone: string;
  email_id?: string | null;
  email_delivered: boolean;
}
export interface ReconEntry {
  status: string;
  date?: string | null;
  description?: string | null;
  utr?: string | null;
  bank_amount?: number | null;
  razorpay_amount?: number | null;
}
export interface ReconResult {
  ran: boolean;
  summary: string;
  total_bank_entries: number;
  total_settlements: number;
  matched: number;
  match_rate: number;
  total_matched_amount: number;
  entries: ReconEntry[];
}
export interface UploadResponse { filename: string; rows_parsed: number; recon: ReconResult }
export interface ForecastDay {
  date: string;
  predicted_inflow: number;
  predicted_outflow: number;
  net_position: number;
  confidence: number;
  is_history: boolean;
}
export interface ForecastAlert { severity: "info" | "warning" | "critical"; message: string }
export interface ForecastResponse { days: ForecastDay[]; alerts: ForecastAlert[] }
export interface AgentStatus {
  name: string;
  label: string;
  status: "idle" | "active" | "done" | "error";
  last_run?: string | null;
  summary?: string | null;
  actions_taken: number;
}
export interface AgentEvent {
  agent_name: string;
  event_type: "thinking" | "action" | "result" | "error";
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown> | null;
}
export interface RazorpayStatus {
  demo_mode: boolean;
  has_credentials: boolean;
  connected: boolean;
  merchant_name: string;
  llm_enabled: boolean;
  model: string;
}
export interface SessionUser {
  email: string;
  name: string;
  role: string;
  merchant: string;
  avatar: string;
}
export interface PayInfo {
  invoice_id: string;
  merchant_name: string;
  amount: number;
  currency: string;
  customer_name: string;
  customer_email: string;
  status: string;
  description: string;
}
export interface PayResult {
  success: boolean;
  status: string;
  failure_reason?: string | null;
  payment_id: string;
  amount: number;
  method: string;
  invoice_id: string;
  brand?: string | null;
  receipt_email_id?: string | null;
}
export interface LedgerRow {
  timestamp: string;
  type: string;
  reference: string;
  party: string;
  detail: string;
  amount: number;
  status: string;
}
export interface EmailSummary {
  id: string;
  kind: string;
  to_name: string;
  to_email: string;
  subject: string;
  delivered: boolean;
  error?: string | null;
  sent_at: string;
  meta: Record<string, unknown>;
}
export interface LiveEvent { kind: string; ts: string; data: Record<string, any> }

// ── Auth token storage ──────────────────────────────────────
const TOKEN_KEY = "kosh_token";
export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  set(token: string) { localStorage.setItem(TOKEN_KEY, token); },
  clear() { localStorage.removeItem(TOKEN_KEY); },
};

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  const t = auth.token;
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: headers() });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}
async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: headers(!!body),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try { detail = (await res.json()).detail ?? detail; } catch { /* noop */ }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // auth
  login: (email: string, password: string) =>
    post<{ token: string; user: SessionUser }>("/api/auth/login", { email, password }),
  me: () => get<SessionUser>("/api/auth/me"),
  logout: () => post<{ ok: boolean }>("/api/auth/logout"),
  demoCredentials: () => get<{ email: string; password: string }>("/api/auth/demo-credentials"),

  // dashboard
  health: () => get<{ status: string; demo_mode: boolean; llm_enabled: boolean; model: string }>("/api/health"),
  dashboardMetrics: () => get<DashboardMetrics>("/api/dashboard/metrics"),
  arAging: () => get<ARAgingResponse>("/api/dashboard/ar-aging"),
  payments: () => get<PaymentRow[]>("/api/dashboard/payments"),

  // collections
  debtors: () => get<DebtorRow[]>("/api/collections/debtors"),
  sendReminder: (invoice_id: string) => post<ReminderResponse>("/api/collections/send-reminder", { invoice_id }),

  // reconciliation
  reconResults: () => get<ReconResult>("/api/reconciliation/results"),
  async uploadStatement(file: File): Promise<UploadResponse> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/reconciliation/upload", { method: "POST", headers: headers(), body: fd });
    if (!res.ok) throw new Error(`upload → ${res.status}`);
    return res.json();
  },

  // forecast
  forecast: () => get<ForecastResponse>("/api/forecast/cashflow"),

  // agents
  agentStatus: () => get<AgentStatus[]>("/api/agents/status"),
  runAgents: () => post<{ started: boolean; run_id: string }>("/api/agents/run"),

  // settings
  razorpayStatus: () => get<RazorpayStatus>("/api/settings/razorpay/status"),
  saveRazorpay: (creds: { key_id: string; key_secret: string; demo_mode: boolean }) =>
    post<RazorpayStatus>("/api/settings/razorpay", creds),
  integrations: () => get<any>("/api/settings/integrations"),
  saveSmtp: (cfg: any) => post<any>("/api/settings/integrations/smtp", cfg),
  saveSheets: (webhook_url: string) => post<any>("/api/settings/integrations/sheets", { webhook_url }),

  // checkout / live
  payInfo: (invoiceId: string) => get<PayInfo>(`/api/pay/${invoiceId}`),
  createOrder: (invoice_id: string) => post<any>("/api/checkout/order", { invoice_id }),
  checkoutPay: (payload: Record<string, unknown>) => post<PayResult>("/api/checkout/pay", payload),

  // ledger / mail / simulator
  ledger: () => get<{ header: string[]; rows: LedgerRow[] }>("/api/ledger"),
  ledgerSync: () => post<{ pushed: number; reason?: string }>("/api/ledger/sync"),
  mailOutbox: () => get<{ emails: EmailSummary[] }>("/api/mail/outbox"),
  mailDetail: (id: string) => get<any>(`/api/mail/${id}`),
  simulator: (action: "start" | "stop" | "tick") => post<any>(`/api/simulator/${action}`),
  simulatorStatus: () => get<{ running: boolean }>("/api/simulator/status"),
};

/** Subscribe to the AI agent activity stream. Returns an unsubscribe fn. */
export function subscribeAgentEvents(onEvent: (e: AgentEvent) => void): () => void {
  const source = new EventSource("/api/agents/events");
  source.addEventListener("agent_event", (ev) => {
    try { onEvent(JSON.parse((ev as MessageEvent).data)); } catch { /* noop */ }
  });
  return () => source.close();
}

/** Subscribe to the live business-event stream (payments, invoices, mail…). */
export function subscribeLive(onEvent: (e: LiveEvent) => void): () => void {
  const source = new EventSource("/api/stream");
  source.addEventListener("live", (ev) => {
    try { onEvent(JSON.parse((ev as MessageEvent).data)); } catch { /* noop */ }
  });
  return () => source.close();
}
