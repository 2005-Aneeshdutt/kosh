import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Wallet, FileCheck2, TrendingUp, Activity, ArrowRight, X, Check, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface Agent {
  key: string;
  name: string;
  tagline: string;
  color: string;
  bg: string;
  icon: typeof Wallet;
  flow: string[];
  before: string;
  after: string;
  metric: { label: string; value: string };
}

const AGENTS: Agent[] = [
  {
    key: "collect", name: "Collect", tagline: "Smart accounts-receivable collection",
    color: "text-collect", bg: "bg-collect", icon: Wallet,
    flow: [
      "Score every overdue invoice on likelihood-to-pay",
      "Prioritise the riskiest accounts first",
      "Draft a personalised reminder — tone escalates with each nudge",
      "Create a Razorpay pay link for one-tap settlement",
      "Send the email and log the action",
    ],
    before: "You chase invoices 2–3 hrs a day, guessing who to call first and writing each reminder by hand.",
    after: "Agents score and chase automatically — riskiest-first — with AI-written reminders and one-tap pay links.",
    metric: { label: "Time on collections", value: "2–3 hrs/day → minutes" },
  },
  {
    key: "recon", name: "Recon", tagline: "Settlement reconciliation",
    color: "text-recon", bg: "bg-recon", icon: FileCheck2,
    flow: [
      "Parse your uploaded bank statement (CSV / PDF)",
      "Extract UTRs — exact and fuzzy matching",
      "Match each line against Razorpay settlements",
      "Flag unmatched and discrepant rows",
      "Explain the gaps in plain English",
    ],
    before: "3+ hours every month matching bank lines to settlements by hand in a spreadsheet.",
    after: "~88% auto-matched in seconds, with a plain-English summary of exactly what doesn't reconcile.",
    metric: { label: "Reconciliation", value: "3+ hrs → seconds" },
  },
  {
    key: "oracle", name: "Oracle", tagline: "Cashflow forecasting",
    color: "text-oracle", bg: "bg-oracle", icon: TrendingUp,
    flow: [
      "Learn daily inflow patterns from settlement history",
      "Weight receivables by pay-likelihood",
      "Project the next 7 days of cashflow",
      "Estimate operational outflow",
      "Raise early-warning alerts on projected shortfalls",
    ],
    before: "A monthly spreadsheet — you discover a cash crunch only after it has already hit.",
    after: "A live 7-day forecast with confidence bands that warns you before the shortfall lands.",
    metric: { label: "Cashflow visibility", value: "Monthly → live 7-day" },
  },
  {
    key: "pulse", name: "Pulse", tagline: "Payment health monitoring",
    color: "text-pulse", bg: "bg-pulse", icon: Activity,
    flow: [
      "Compute live success rates by payment method",
      "Detect anomalies via z-score analysis",
      "Break down failure reasons",
      "Surface specific, actionable insights",
    ],
    before: "You notice payment problems only when the day's revenue looks low.",
    after: "Anomalies — like a UPI success-rate dip — flagged in real time with the likely cause.",
    metric: { label: "Anomaly detection", value: "Reactive → real-time" },
  },
];

export function AgentsPage() {
  const [params] = useSearchParams();
  const initial = AGENTS.findIndex((a) => a.key === params.get("a"));
  const [sel, setSel] = useState(initial >= 0 ? initial : 0);
  const a = AGENTS[sel];

  return (
    <div className="space-y-6">
      <Card className="bg-navy-900 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h2 className="font-display text-lg font-bold">How the crew works</h2>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-slate-300">
          Four specialised agents run in parallel over a shared merchant state, reasoning with Claude.
          Pick one to see its workflow — and what it replaces.
        </p>
      </Card>

      {/* Selector */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {AGENTS.map((ag, i) => {
          const Icon = ag.icon;
          const active = i === sel;
          return (
            <button key={ag.key} onClick={() => setSel(i)}>
              <Card className={cn("p-4 text-left transition-all", active ? "ring-2 ring-brand shadow-glow" : "hover:border-slate-300")}>
                <div className="flex items-center justify-between">
                  <div className={cn("rounded-xl bg-slate-50 p-2", ag.color)}><Icon className="h-5 w-5" /></div>
                  <span className={cn("h-2 w-2 rounded-full", ag.bg)} />
                </div>
                <div className="mt-2 font-bold text-ink">{ag.name}</div>
                <div className="text-xs text-muted">{ag.tagline}</div>
              </Card>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={a.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
          {/* Flow */}
          <Card>
            <div className="mb-5 flex items-center gap-3">
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl text-white", a.bg)}>
                <a.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-lg font-bold text-ink">{a.name} agent</div>
                <div className="text-sm text-muted">{a.tagline}</div>
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
              {a.flow.map((step, i) => (
                <div key={i} className="flex items-center gap-3 lg:flex-1 lg:flex-col lg:items-start">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex-1 rounded-xl border border-border bg-slate-50/60 p-3"
                  >
                    <div className={cn("mb-1.5 flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold text-white", a.bg)}>
                      {i + 1}
                    </div>
                    <div className="text-[13px] leading-snug text-slate-700">{step}</div>
                  </motion.div>
                  {i < a.flow.length - 1 && (
                    <ArrowRight className="h-4 w-4 shrink-0 rotate-90 text-slate-300 lg:rotate-0 lg:self-center" />
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Before / After */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="border-danger/20 bg-red-50/30">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-danger">
                <X className="h-4 w-4" /> Without Kosh
              </div>
              <p className="text-sm leading-relaxed text-slate-600">{a.before}</p>
            </Card>
            <Card className="border-success/20 bg-emerald-50/30">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-success">
                <Check className="h-4 w-4" /> With Kosh
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{a.after}</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs">
                <span className="text-muted">{a.metric.label}:</span>
                <span className="font-bold text-ink">{a.metric.value}</span>
              </div>
            </Card>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
