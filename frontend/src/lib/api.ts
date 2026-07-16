// Typed API client + SSE event source for the Kosh backend.

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
export interface ARAgingBucket {
  bucket: string;
  amount: number;
  count: number;
}
export interface ARAgingResponse {
  buckets: ARAgingBucket[];
  total_outstanding: number;
}
export interface PaymentRow {
  id: string;
  customer_name: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
  failure_reason?: string | null;
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
export interface UploadResponse {
  filename: string;
  rows_parsed: number;
  recon: ReconResult;
}
export interface ForecastDay {
  date: string;
  predicted_inflow: number;
  predicted_outflow: number;
  net_position: number;
  confidence: number;
  is_history: boolean;
}
export interface ForecastAlert {
  severity: "info" | "warning" | "critical";
  message: string;
}
export interface ForecastResponse {
  days: ForecastDay[];
  alerts: ForecastAlert[];
}
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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<{ status: string; demo_mode: boolean; llm_enabled: boolean; model: string }>("/api/health"),
  dashboardMetrics: () => get<DashboardMetrics>("/api/dashboard/metrics"),
  arAging: () => get<ARAgingResponse>("/api/dashboard/ar-aging"),
  payments: () => get<PaymentRow[]>("/api/dashboard/payments"),
  debtors: () => get<DebtorRow[]>("/api/collections/debtors"),
  sendReminder: (invoice_id: string) =>
    post<ReminderResponse>("/api/collections/send-reminder", { invoice_id }),
  reconResults: () => get<ReconResult>("/api/reconciliation/results"),
  forecast: () => get<ForecastResponse>("/api/forecast/cashflow"),
  agentStatus: () => get<AgentStatus[]>("/api/agents/status"),
  runAgents: () => post<{ started: boolean; run_id: string }>("/api/agents/run"),
  razorpayStatus: () => get<RazorpayStatus>("/api/settings/razorpay/status"),
  saveRazorpay: (creds: { key_id: string; key_secret: string; demo_mode: boolean }) =>
    post<RazorpayStatus>("/api/settings/razorpay", creds),
  async uploadStatement(file: File): Promise<UploadResponse> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/reconciliation/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error(`upload → ${res.status}`);
    return res.json();
  },
};

/** Subscribe to the live agent event stream. Returns an unsubscribe fn. */
export function subscribeAgentEvents(onEvent: (e: AgentEvent) => void): () => void {
  const source = new EventSource("/api/agents/events");
  source.addEventListener("agent_event", (ev) => {
    try {
      onEvent(JSON.parse((ev as MessageEvent).data));
    } catch {
      /* ignore malformed frames */
    }
  });
  return () => source.close();
}
