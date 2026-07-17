# Kosh (कोष) — Multi-Agent Revenue Operations for Razorpay Merchants

> Connect your Razorpay account → Kosh's **4 AI agents** start working immediately.
> Collections happen automatically, settlements reconcile in seconds, cashflow is
> predicted daily, and payment anomalies are caught before they cost you money.

Kosh is an AI Revenue-Operations Copilot  that  deploys a crew of four specialized agents — orchestrated with
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

---

## Autopilot — autonomy *with* guardrails

The hard part of agentic AI isn't taking actions; it's knowing which actions a
machine may take alone. Kosh's **Autopilot** makes that explicit:

1. **Agents propose, they don't blindly act.** Every open invoice produces a typed
   proposal — `reminder`, `escalate`, `discount_offer`, or `collect` — each with an
   AI-written **rationale**, a risk band, and a confidence score.
2. **A policy engine decides the path.** Low-value, low-risk reminders
   **auto-execute**. Anything above the amount/risk thresholds — plus *every*
   discount offer and direct collection — is routed to a human.
3. **A human approves the rest.** The **approval queue** shows each proposal with
   its reasoning; Approve runs it for real (sends the email, creates the pay link,
   collects the payment), Reject discards it.
4. **A scheduler runs it autonomously** when engaged, so collections keep moving
   without anyone clicking.

Thresholds are tunable at runtime (`POST /api/autopilot/policy`). This is the
pattern a payments company actually needs: autonomy where it's safe, a human
where it matters.

---

## Kosh Copilot — a chatbot that *does* things

A floating assistant on every page that answers from live data **and takes real
actions** (Claude tool-calling when an API key is set; a capable rule-based
router offline):

| You say | It does |
|---|---|
| *"How are we doing?"* | Live revenue, success rate, outstanding, biggest overdue |
| *"Who's overdue?"* | Ranked chase list by risk |
| *"Remind Bangalore Brew House"* | Sends the reminder email + pay link |
| *"Pay INV-1020"* | **Actually captures the payment** — dashboard updates live |
| *"Give me a pay link for INV-1024"* | Returns an **Open checkout** button |
| *"Run the agents"* | Launches the four-agent crew |

---

## The 60-second demo script

1. **Sign in** (one click).
2. **Run All Agents** — watch the crew work the live feed; reminder emails land in
   the **Outbox**.
3. **Autopilot** → **Engage** — see proposals appear, some auto-executed within
   policy, the rest waiting for you. **Approve** one and watch it fire.
4. **Reconciliation** → **Use demo statement** (or drop
   `seed/sample_bank_statement.csv`) → Recon matches **88.5%** and explains the
   gaps in plain English.
5. **Collections** → **Pay link** on an overdue invoice → the Razorpay-style
   checkout opens. Pay with `4111 1111 1111 1111`.
6. Flip to the **Dashboard** — revenue animates up, the invoice is gone from
   Collections, the **Ledger** has a new row, the receipt is in the **Outbox**.
7. Ask the **Copilot**: *"who's overdue?"* → *"pay INV-1021"* → watch it collect.

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
| `KOSH_PUBLIC_URL` | `http://localhost:8000` | Base URL used for pay links inside emails. |
| `KOSH_SMTP_*` | — | Real email delivery (see below). |
| `KOSH_MAIL_REDIRECT` | — | Deliver every demo email to one inbox. |

---

## Turning on real email (Gmail, ~2 minutes)

Reminders and receipts always appear in the in-app **Outbox**. To have them
actually delivered:

1. Create a **dedicated Gmail** for Kosh (e.g. `kosh.revops@gmail.com`).
2. Enable **2-Step Verification** → https://myaccount.google.com/security
   *(the App Password option does not appear until this is on).*
3. Create an **App Password** → https://myaccount.google.com/apppasswords
   → app **Mail**, device **Other → "Kosh"**. Google returns a 16-character code.
4. Put it in **Settings → Email** (click *Use Gmail preset*), or in `.env`:

```bash
KOSH_SMTP_HOST=smtp.gmail.com
KOSH_SMTP_PORT=587
KOSH_SMTP_USER=kosh.revops@gmail.com
KOSH_SMTP_PASSWORD=your16charapppassword   # App Password, NOT your login password
KOSH_SMTP_FROM=kosh.revops@gmail.com
KOSH_MAIL_REDIRECT=you@example.com         # every demo email lands here
```

5. Hit **Send test email**. Then **Collections → Remind** delivers a real email
   whose **Pay now** button opens the live checkout.

> Your normal Gmail password will be rejected (`535 Username and Password not
> accepted`) — Google requires an App Password for SMTP.

---

## Production hardening & Razorpay integration roadmap

Kosh is a working showcase, and these are the deliberate lines between *demo* and
*production* — documented rather than hidden:

| Area | Today (demo) | Production path |
|---|---|---|
| **Checkout** | High-fidelity Razorpay-style checkout, simulated authorisation with predictable test cards. | Drop in **Razorpay Checkout.js** + Orders API; reconcile via **webhooks with signature verification**. The client already isolates this behind `razorpay_client/`. |
| **Card data / PCI** | The demo form accepts card fields to make the flow tangible. | **Never touch PAN.** Razorpay Checkout tokenises client-side; the server only ever sees a token/`payment_id`. No PCI scope. |
| **Payment integrity** | Atomic in-process invoice claim prevents double-capture (stress-tested: 12 concurrent payments → exactly 1 capture). | **Idempotency keys** per payment attempt + DB constraints for exactly-once across replicas. |
| **State & scale** | Single-process in-memory live dataset (correct for a single-node demo). | Postgres + **Redis** for shared state, multiple uvicorn workers, a queue for agent runs. |
| **Agent safety** | Policy engine + human-in-the-loop approvals for risky actions. | Add full **audit log**, per-action RBAC, and rollback. |
| **LLM** | Claude tool-calling with a deterministic offline fallback. | **Prompt-injection defence**, PII redaction before prompts, response schemas, evals + cost/latency tracing. |
| **Auth** | Token sessions, in-memory. | Real JWT + refresh, multi-tenant, OAuth onboarding to connect a merchant's Razorpay account. |
| **Outreach** | Email (SMTP). | **WhatsApp/SMS** (the channel Indian SMBs actually read) with an escalation ladder. |
| **Ecosystem** | Uses the Razorpay SDK directly. | Expose Kosh's tools as an **MCP server** so Razorpay **Agent Studio** / Claude Desktop can call them. |

### Where Kosh maps onto Razorpay's product surface

| Kosh module | Razorpay product it complements |
|---|---|
| Collections / pay links | Payment Links, Smart Collect, subscription dunning |
| Recon | Settlement reports, RazorpayX reconciliation |
| Oracle (cashflow) | RazorpayX, **Razorpay Capital** (working-capital offers) |
| Pulse (payment health) | Payment analytics, Optimizer / Smart Retry |
| Autopilot | **Razorpay Agent Studio** (Claude Agent SDK) |

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
| POST | `/api/auth/login` · `/logout` · GET `/me` | Session auth |
| GET | `/api/stream` | **SSE** stream of live business events |
| GET | `/api/pay/{invoice_id}` | Public checkout data |
| POST | `/api/checkout/order` · `/checkout/pay` | Create order · take payment |
| POST | `/api/chat` | Kosh Copilot (answers + actions) |
| GET/POST | `/api/autopilot/status` · `/start` · `/stop` · `/scan` | Autopilot control |
| GET | `/api/autopilot/proposals` | Proposal queue |
| POST | `/api/autopilot/proposals/{id}/approve` · `/reject` | Human-in-the-loop |
| POST | `/api/autopilot/policy` | Tune auto-approve thresholds |
| GET | `/api/ledger` · `/ledger/export.csv` | Live ledger · CSV export |
| POST | `/api/ledger/sync` | Push ledger to Google Sheets |
| GET | `/api/mail/outbox` · `/mail/{id}` | Email outbox + rendered HTML |
| POST | `/api/settings/integrations/smtp` · `/sheets` · `/test-email` | Integrations |
| POST | `/api/simulator/start` · `/stop` · `/tick` | Live payment simulator |
| GET | `/api/reconciliation/sample.csv` | Download the demo bank statement |

---

## Project layout

```
backend/
  main.py                 FastAPI app + CORS + routers + SPA serving
  config.py               env-backed settings
  razorpay_client/        SDK wrapper (client.py) + rich mock_data.py
  agents/                 state, bus (SSE), 4 agents, orchestrator, store
  services/
    live_data.py          mutable live dataset (single source of truth)
    payments.py           checkout processing, test cards, receipts
    autopilot.py          proposals, policy engine, approvals, scheduler
    copilot.py            conversational assistant + action tools
    mailer.py             HTML emails, outbox, SMTP delivery
    sheets.py             ledger + CSV + Google Sheets sync
    auth.py  simulator.py  llm.py  debtor_scorer.py
    anomaly_detector.py   invoice_parser.py
  models/                 schemas (Pydantic) + database (SQLite)
  routers/                auth, dashboard, agents, collections, upload,
                          forecast, settings, live, chat, autopilot
frontend/
  src/
    components/           layout, agents, dashboard, collections, chat, ui
    pages/                Login, Checkout, Dashboard, Collections, Autopilot,
                          Reconciliation, Forecast, Ledger, Mail, Settings
    context/              AuthContext, LiveContext (SSE), RunContext
    lib/                  api client, formatting helpers
seed/
  generate_mock_data.py     regenerate the dataset
  sample_bank_statement.csv ← upload this on the Reconciliation page
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
