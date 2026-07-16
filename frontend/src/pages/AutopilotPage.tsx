import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot, Zap, Check, X, RefreshCw, ShieldCheck, Loader2, Mail, TrendingDown,
  Sparkles, Gavel, CircleDollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, Badge, Button } from "@/components/ui/primitives";
import { api, type AutopilotStatus, type Proposal } from "@/lib/api";
import { formatPaisa, formatPaisaCompact, timeAgo } from "@/lib/format";
import { useLive } from "@/context/LiveContext";
import { cn } from "@/lib/utils";

const TYPE_META: Record<string, { icon: typeof Mail; label: string; variant: "brand" | "warning" | "danger" | "purple" }> = {
  reminder: { icon: Mail, label: "Send reminder", variant: "brand" },
  escalate: { icon: TrendingDown, label: "Escalate tone", variant: "warning" },
  discount_offer: { icon: CircleDollarSign, label: "Offer discount", variant: "purple" },
  collect: { icon: Zap, label: "Collect now", variant: "danger" },
};
const BAND_VARIANT: Record<string, "success" | "brand" | "warning" | "danger"> = {
  low: "success", medium: "brand", high: "warning", critical: "danger",
};

export function AutopilotPage() {
  const { events } = useLive();
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [pending, setPending] = useState<Proposal[]>([]);
  const [handled, setHandled] = useState<Proposal[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(() => {
    api.autopilotStatus().then(setStatus).catch(() => {});
    api.autopilotProposals().then((d) => {
      setPending(d.proposals.filter((p) => p.status === "pending"));
      setHandled(d.proposals.filter((p) => p.status !== "pending").slice(0, 12));
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // React to live proposal events (auto-executed by the scheduler, etc.).
  const propEvents = events.filter((e) => e.kind === "proposal" || e.kind === "proposal_update").length;
  useEffect(() => { load(); }, [propEvents, load]);

  async function toggle() {
    if (!status) return;
    const s = status.running ? await api.autopilotStop() : await api.autopilotStart();
    setStatus(s);
    toast[s.running ? "success" : "info"](s.running ? "Autopilot engaged — agents will act within policy" : "Autopilot paused");
  }
  async function scan() {
    setScanning(true);
    try { const r = await api.autopilotScan(); toast.success(`Scan complete · ${r.created} new, ${r.auto_executed} auto-executed`); load(); }
    catch { toast.error("Scan failed"); }
    finally { setScanning(false); }
  }
  async function decide(p: Proposal, action: "approve" | "reject") {
    setBusy(p.id);
    try {
      const res = action === "approve" ? await api.autopilotApprove(p.id) : await api.autopilotReject(p.id);
      toast[action === "approve" ? "success" : "info"](action === "approve" ? `Approved · ${res.result ?? "done"}` : "Proposal rejected");
      setPending((prev) => prev.filter((x) => x.id !== p.id));
      setTimeout(load, 400);
    } catch { toast.error("Action failed"); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", status?.running ? "bg-brand text-white shadow-glow" : "bg-slate-100 text-muted")}>
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-ink">Collections Autopilot</h2>
              <Badge variant={status?.running ? "success" : "default"}>{status?.running ? "Engaged" : "Paused"}</Badge>
            </div>
            <p className="text-sm text-muted">
              Agents propose actions; safe ones auto-execute, the rest wait for your approval.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={scan} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Scan now
          </Button>
          <Button onClick={toggle} variant={status?.running ? "danger" : "primary"}>
            {status?.running ? <>Pause autopilot</> : <><Sparkles className="h-4 w-4" /> Engage autopilot</>}
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<Gavel className="h-4 w-4 text-warning" />} label="Awaiting approval" value={String(status?.pending ?? 0)} sub={status ? formatPaisaCompact(status.pending_value / 100) : ""} />
        <Stat icon={<Zap className="h-4 w-4 text-brand" />} label="Auto-executed" value={String(status?.auto_executed ?? 0)} sub="within policy" />
        <Stat icon={<Check className="h-4 w-4 text-success" />} label="You approved" value={String(status?.approved ?? 0)} sub="human-in-the-loop" />
        <Stat icon={<ShieldCheck className="h-4 w-4 text-oracle" />} label="Under management" value={status ? formatPaisaCompact(status.managed_value / 100) : "—"} sub="receivables" />
      </div>

      {/* Policy banner */}
      {status && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm">
          <ShieldCheck className="h-4 w-4 text-brand" />
          <span className="font-medium text-ink">Policy:</span>
          <span className="text-muted">
            auto-approve reminders ≤ <b className="text-ink">{formatPaisa(status.policy.auto_max_amount)}</b> and
            risk ≤ <b className="text-ink">{status.policy.auto_max_risk.toFixed(2)}</b>.
          </span>
          <span className="text-muted">Discounts & direct collection <b className="text-ink">always</b> need your sign-off.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Approval queue */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Gavel className="h-4 w-4 text-warning" /> Needs your approval
            <Badge variant="warning">{pending.length}</Badge>
          </h3>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {pending.map((p) => {
                const meta = TYPE_META[p.type] ?? TYPE_META.reminder;
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                  >
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={cn("mt-0.5 rounded-xl bg-slate-50 p-2 text-ink")}><Icon className="h-4 w-4" /></div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-ink">{p.customer_name}</span>
                              <Badge variant={meta.variant}>{meta.label}</Badge>
                              <Badge variant={BAND_VARIANT[p.risk_band]}>{p.risk_band} risk</Badge>
                            </div>
                            <div className="mt-0.5 text-xs text-muted">
                              {p.invoice_id} · {formatPaisa(p.amount)} · {p.days_overdue}d overdue · confidence {(p.confidence * 100).toFixed(0)}%
                            </div>
                            <p className="mt-2 text-[13px] leading-snug text-slate-600">
                              <Sparkles className="mr-1 inline h-3 w-3 text-brand" />{p.rationale}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => decide(p, "reject")} disabled={busy === p.id}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                        <Button size="sm" onClick={() => decide(p, "approve")} disabled={busy === p.id}>
                          {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve &amp; run
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {pending.length === 0 && (
              <Card className="p-8 text-center text-sm text-muted">
                Nothing awaiting approval. Hit <b>Scan now</b> or engage autopilot to generate proposals.
              </Card>
            )}
          </div>
        </div>

        {/* Executed feed */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Zap className="h-4 w-4 text-brand" /> Recently executed
          </h3>
          <Card className="p-0">
            <div className="scroll-thin divide-y divide-slate-50 overflow-y-auto" style={{ maxHeight: 520 }}>
              {handled.map((p) => {
                const meta = TYPE_META[p.type] ?? TYPE_META.reminder;
                return (
                  <div key={p.id} className="flex items-start gap-3 px-4 py-3">
                    <div className={cn(
                      "mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg",
                      p.status === "rejected" ? "bg-red-50 text-danger" : p.status === "auto_executed" ? "bg-blue-50 text-brand" : "bg-emerald-50 text-success"
                    )}>
                      {p.status === "rejected" ? <X className="h-3.5 w-3.5" /> : p.status === "auto_executed" ? <Zap className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-ink">{p.customer_name}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{p.executed_at ? timeAgo(p.executed_at) : ""}</span>
                      </div>
                      <div className="text-xs text-muted">
                        {p.status === "auto_executed" ? "Auto" : p.status === "rejected" ? "Rejected" : "Approved"} · {meta.label} · {formatPaisa(p.amount)}
                      </div>
                      {p.result && <div className="mt-0.5 text-[11px] text-slate-400">{p.result}</div>}
                    </div>
                  </div>
                );
              })}
              {handled.length === 0 && <div className="p-8 text-center text-sm text-muted">No actions yet.</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">{icon} {label}</div>
      <div className="mt-1 font-display text-2xl font-extrabold text-ink">{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </Card>
  );
}
