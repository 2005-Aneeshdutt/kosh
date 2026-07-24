import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot, User, Cpu, ScrollText, CheckCircle2, XCircle, Send, CreditCard,
  LogIn, LogOut, Sparkles, ShieldCheck, Play, Pause, FileCheck2, ToggleLeft,
} from "lucide-react";
import { Card, Badge, Skeleton } from "@/components/ui/primitives";
import { api, type AuditEntry } from "@/lib/api";
import { formatPaisa, timeAgo } from "@/lib/format";
import { useLive } from "@/context/LiveContext";
import { useRun } from "@/context/RunContext";
import { cn } from "@/lib/utils";

const ACTOR_META: Record<string, { icon: typeof Bot; ring: string; chip: string; label: string }> = {
  agent: { icon: Bot, ring: "bg-oracle/10 text-oracle", chip: "purple", label: "Agent" },
  human: { icon: User, ring: "bg-brand/10 text-brand", chip: "brand", label: "Human" },
  system: { icon: Cpu, ring: "bg-slate-100 text-slate-500", chip: "default", label: "System" },
};

const ACTION_ICON: Record<string, typeof Send> = {
  "reminder.sent": Send,
  "payment.captured": CreditCard,
  "proposal.approved": CheckCircle2,
  "proposal.rejected": XCircle,
  "proposal.auto_executed": Sparkles,
  "agents.run": Sparkles,
  "autopilot.started": Play,
  "autopilot.stopped": Pause,
  "reconciliation.upload": FileCheck2,
  "studio.agent_toggled": ToggleLeft,
  "user.login": LogIn,
  "user.logout": LogOut,
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "agent", label: "Agents" },
  { key: "human", label: "Human" },
  { key: "system", label: "System" },
];

function humanize(action: string) {
  return action.replace(/\./g, " · ").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AuditPage() {
  const { pulse } = useLive();
  const { runVersion } = useRun();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [summary, setSummary] = useState({ total: 0, agent: 0, human: 0, system: 0 });
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.audit({ limit: 150, actor_type: filter })
      .then((r) => { setEntries(r.entries); setSummary(r.summary); })
      .catch(() => setEntries([]));
  }, [filter, pulse, runVersion]);

  const grouped = useMemo(() => groupByDay(entries ?? []), [entries]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard icon={ScrollText} label="Total events" value={summary.total} accent="text-ink" />
        <SummaryCard icon={Bot} label="Agent actions" value={summary.agent} accent="text-oracle" />
        <SummaryCard icon={User} label="Human decisions" value={summary.human} accent="text-brand" />
        <SummaryCard icon={Cpu} label="System events" value={summary.system} accent="text-slate-500" />
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition",
                filter === f.key
                  ? "border-brand bg-brand-gradient text-white shadow-glow"
                  : "border-border text-muted hover:border-brand/30 hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-success" /> Immutable trail
        </div>
      </div>

      {/* Timeline */}
      <Card className="p-6">
        {entries === null ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">
            No activity yet. Run the agents or send a reminder to populate the trail.
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([day, items]) => (
              <div key={day}>
                <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted">{day}</div>
                <div className="relative space-y-1 before:absolute before:left-[18px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
                  {items.map((e, i) => {
                    const meta = ACTOR_META[e.actor_type] ?? ACTOR_META.system;
                    const Icon = ACTION_ICON[e.action] ?? meta.icon;
                    return (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                        className="relative flex gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-50"
                      >
                        <div className={cn("z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-4 ring-card", meta.ring)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 py-0.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold text-ink">{humanize(e.action)}</span>
                            <Badge variant={meta.chip as any}>{e.actor}</Badge>
                            {e.amount ? <span className="text-xs font-semibold text-success">{formatPaisa(e.amount)}</span> : null}
                            <span className="ml-auto shrink-0 text-[11px] text-muted">{timeAgo(e.ts)}</span>
                          </div>
                          {e.detail && <div className="mt-0.5 text-[13px] text-muted">{e.detail}</div>}
                          {e.target && <div className="mt-0.5 font-mono text-[11px] text-slate-400">{e.target}</div>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, accent }: { icon: typeof Bot; label: string; value: number; accent: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        <Icon className="h-4 w-4 text-muted" />
      </div>
      <div className={cn("mt-1 font-display text-2xl font-extrabold tabular", accent)}>{value}</div>
    </Card>
  );
}

function groupByDay(entries: AuditEntry[]): [string, AuditEntry[]][] {
  const today = new Date().toDateString();
  const yst = new Date(Date.now() - 86400000).toDateString();
  const map = new Map<string, AuditEntry[]>();
  for (const e of entries) {
    const d = new Date(e.ts).toDateString();
    const label = d === today ? "Today" : d === yst ? "Yesterday" : new Date(e.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const arr = map.get(label) ?? [];
    arr.push(e);
    map.set(label, arr);
  }
  return [...map.entries()];
}
