# Kosh (कोष) — Multi-Agent Revenue Operations for Razorpay Merchants

> Connect your Razorpay account → Kosh's **4 AI agents** start working immediately.
> Collections happen automatically, settlements reconcile in seconds, cashflow is
> predicted daily, and payment anomalies are caught before they cost you money.

Kosh is an AI Revenue-Operations Copilot built for the **Razorpay AI Builders**
program. It deploys a crew of four specialized agents — orchestrated with
**LangGraph** over a shared merchant state and reasoning with **Claude
(Sonnet 5)** — all visible through a single real-time dashboard.

![agents](https://img.shields.io/badge/agents-4-3B82F6) ![demo](https://img.shields.io/badge/demo_mode-zero_config-10B981) ![stack](https://img.shields.io/badge/FastAPI%20%2B%20React-informational)

---

## The crew

| Agent | Colour | What it does |
|-------|--------|--------------|
| 🔵 **Collect** | blue | Scores every overdue invoice on likelihood-to-pay, writes a personalised reminder whose tone escalates with prior nudges, and creates a Razorpay **payment link** for one-tap settlement. |
| 🟢 **Recon** | green | Matches your uploaded **bank statement** against Razorpay settlements by UTR (exact + fuzzy) with an amount tolerance, and explains the mismatches in plain English. |
| 🟣 **Oracle** | purple | Learns daily inflow patterns and projects a **7-day cashflow** forecast, raising early-warning alerts on projected shortfalls. |
| 🟠 **Pulse** | amber | Monitors payment **success rates**, detects anomalies via z-score, and surfaces specific, actionable insights. |

They run **in parallel** from a single "Run All Agents" click, and every step
streams to the dashboard's **Agent Activity feed** over Server-Sent Events.

---

## A live, shippable product — not a mockup

Kosh behaves like a real SaaS you sign into and operate:

- **Sign in / out.** Token-based auth with a merchant profile. One-click demo
  sign-in (`demo@artisancoffee.in` / `razorpay`).
- **A real Razorpay-style checkout.** Every invoice has a live payment page
  (`/pay/:invoice`) with Card / UPI / Netbanking tabs, card-number formatting +
  brand detection, predictable **test cards** (`4111 1111 1111 1111` succeeds,
  `4000 0000 0000 0002` declines), a processing animation, and a receipt.
- **The live loop.** The moment a customer pays, the **merchant dashboard
  updates in real time** over a global SSE stream: revenue counter animates up,
  the invoice clears from Collections, the payment appears in the Ledger, the
  Activity feed logs it, and a receipt lands in the Outbox. *Open the pay link in
  one tab, pay, and watch the dashboard in another move.*
- **Email integration.** Every AI reminder and payment receipt is rendered as a
  branded HTML email in an in-app **Outbox** — and **actually delivered over
  SMTP** once you add credentials (Settings → Email; a Gmail app-password works).
- **Real-time sheet sync.** A live **Ledger** page streams every transaction,
  exports to **CSV**, and pushes to a **Google Sheet** in real time via an Apps
  Script webhook (Settings → Google Sheets; the 12-line script is provided).
- **Always-alive data.** A background **payment simulator** streams realistic
  transactions so the dashboard is never static (toggle it from the header).

### The 30-second "wow" demo

1. **Sign in** (one click).
2. Click **Run All Agents** — watch the four agents work the feed; 6 reminder
   emails appear in the **Outbox**.
3. Go to **Collections**, click **Pay link** on an overdue invoice → the
   Razorpay-style checkout opens in a new tab.
4. Pay with `4111 1111 1111 1111`. Flip back to the **Dashboard** — revenue ticks
   up live, the invoice is gone from Collections, the **Ledger** has a new row,
   and the receipt is in the **Outbox**.

---

## Zero-config demo mode

The app runs **fully offline with realistic mock data** — no Razorpay keys, no
Claude key required. The demo merchant *Artisan Coffee Co.* has a story baked in
that the agents discover on their own:

- A large overdue invoice from **Bangalore Brew House** (₹1,20,000) that threatens Friday payroll.
- A **UPI success-rate dip** on a specific afternoon (Pulse catches it).
- A projected **Thursday cash crunch** (Oracle warns about it).
- A bank statement with a few intentional unmatched / discrepant rows (Recon flags them).

Set `ANTHROPIC_API_KEY` to upgrade the agent copy from deterministic templates to
live, Claude-authored reminders, summaries and insights — everything else is
identical.

---

## Architecture

```
 React 18 + Tailwind + Recharts + Framer Motion  (frontend/)
        │  REST + SSE
        ▼
 FastAPI  (backend/main.py)
        │
 LangGraph orchestrator  (agents/orchestrator.py)
   fetch_data → [ pulse ∥ oracle ∥ collect ] → recon → summarize
        │  shared MerchantState
        ├── Razorpay SDK client (demo + live)   razorpay_client/
        ├── Claude (Sonnet 5) w/ offline fallback  services/llm.py
        └── SQLite  (runs, events, settings)
```

> **Why the SDK over MCP?** Kosh uses the `razorpay` Python SDK directly inside
> its LangGraph nodes for tighter control. It stays MCP-compatible — the same
> endpoints are exposed by Razorpay's MCP server, and Kosh complements Razorpay's
> Claude-Agent-SDK-based Agent Studio.

---

## Quick start — one command, one link

The whole product (all pages + API + live agent feed) is served from a **single
server at one URL**. No separate frontend server, no proxy to run.

```bash
cd razorpay
python -m venv .venv
.venv/Scripts/activate            # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r backend/requirements.txt

python run.py                     # builds the frontend if needed, then serves
```

Open **http://localhost:8000** and click **Run All Agents**. That's it.

`run.py` flags: `--build` (force a fresh frontend build), `--port 9000`,
`--dev` (skip the build and serve the existing `frontend/dist`).

> First run builds the React app (needs Node 18+). Later runs reuse the build
> and start instantly. Demo mode needs no keys and no `.env`.

### Developing the frontend with hot-reload (optional)

For live UI editing you can still run Vite separately — it proxies `/api` to the
backend:

```bash
uvicorn backend.main:app --reload --port 8000   # terminal 1 (API)
cd frontend && npm run dev                        # terminal 2 → http://localhost:5173
```

### Docker (single container network)

```bash
docker compose up --build         # app on :5173, API on :8000
```

---

## Configuration (`.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEMO_MODE` | `true` | Use mock data; no Razorpay calls. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | — | Live Razorpay test/live keys. |
| `ANTHROPIC_API_KEY` | — | Enables live Claude agent copy (optional). |
| `KOSH_MODEL` | `claude-sonnet-5` | Model used by all agents. |
| `CORS_ORIGINS` | `localhost:5173` | Allowed frontend origins. |

---

## API surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness + demo/LLM flags |
| GET | `/api/dashboard/metrics` | Metric cards (revenue, success rate, outstanding, forecast) |
| GET | `/api/dashboard/ar-aging` | AR aging buckets (0-30/30-60/60-90/90+) |
| GET | `/api/dashboard/payments` | Recent payments feed |
| POST | `/api/agents/run` | Trigger the full crew (background) |
| GET | `/api/agents/events` | **SSE** stream of live agent events |
| GET | `/api/agents/status` | Per-agent status |
| GET | `/api/collections/debtors` | Risk-scored debtor list |
| POST | `/api/collections/send-reminder` | Generate a reminder + payment link |
| POST | `/api/reconciliation/upload` | Upload a bank statement (CSV/PDF) |
| GET | `/api/reconciliation/results` | Latest reconciliation result |
| GET | `/api/forecast/cashflow` | 7-day forecast + alerts |
| GET/POST | `/api/settings/razorpay[/status]` | Manage credentials + demo mode |

---

## Project layout

```
backend/
  main.py                 FastAPI app + CORS + routers
  config.py               env-backed settings
  razorpay_client/        SDK wrapper (client.py) + rich mock_data.py
  agents/                 state, bus (SSE), 4 agents, orchestrator, store
  services/               llm, debtor_scorer, anomaly_detector, invoice_parser
  models/                 schemas (Pydantic) + database (SQLite)
  routers/                dashboard, agents, collections, upload, forecast, settings
frontend/
  src/
    components/           layout, agents (feed/cards), dashboard, collections, ui
    pages/                Dashboard, Collections, Reconciliation, Forecast, Settings
    context/RunContext    shared run state + SSE fan-out
    hooks/useAgentStream  live event subscription
    lib/                  api client, formatting helpers
seed/                     mock dataset + sample_bank_statement.csv generator
```

---

## Why it wins

1. **Multi-agent coordination is visible** — the activity feed shows Collect
   scoring debtors while Oracle forecasts and Pulse monitors, all at once.
2. **It solves a real ₹15k–30k/year problem** — Indian SMBs pay CAs for exactly
   this reconciliation + collections work; Kosh does it in ~30 seconds.
3. **Built _on_ Razorpay, not against it** — uses the SDK, complements Agent
   Studio, showcases the payment ecosystem.
4. **Production-grade UI** — a clean fintech dashboard, not a hackathon skin.
5. **The demo data tells a story** — a UPI anomaly, overdue invoices, and a
   Thursday cash crunch, all discovered by the agents independently.
