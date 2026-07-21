import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { TrendingUp, Clock, IndianRupee, Timer, ArrowRight, Check, X } from "lucide-react";
import { Card, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { api, type ImpactResponse } from "@/lib/api";
import { formatCompactRupees } from "@/lib/format";
import { useLive } from "@/context/LiveContext";

export function ImpactPage() {
  const { pulse } = useLive();
  const [data, setData] = useState<ImpactResponse | null>(null);

  useEffect(() => { api.impact().then(setData).catch(() => {}); }, [pulse]);
  if (!data) return null;
  const h = data.headline;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="relative overflow-hidden bg-navy-900 text-white">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle,#3395FF,transparent 70%)" }} />
        <div className="relative">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Estimated annual value of Kosh</div>
          <div className="mt-1 font-display text-5xl font-extrabold tracking-tight">
            <AnimatedCounter value={h.annual_value} format={(n) => formatCompactRupees(n)} />
          </div>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Time your team gets back, plus receivables recovered by proactive, risk-scored chasing —
            computed from your live data.
          </p>
        </div>
      </Card>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric icon={<Clock className="h-4 w-4 text-brand" />} label="Hours saved / month" value={h.hours_saved_monthly.toString()} sub="collections + recon + forecast" />
        <Metric icon={<IndianRupee className="h-4 w-4 text-success" />} label="Cash recovered" value={formatCompactRupees(h.cash_recovered)} sub="proactive chasing uplift" />
        <Metric icon={<Timer className="h-4 w-4 text-oracle" />} label="DSO reduction" value={`${h.dso_reduction} days`} sub="faster collections cycle" />
        <Metric icon={<TrendingUp className="h-4 w-4 text-warning" />} label="Reconciliation" value="seconds" sub="vs 3+ hours manual" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
        {/* With vs without table */}
        <Card>
          <CardHeader>
            <CardTitle>Manual vs. Kosh</CardTitle>
            <Badge variant="brand">live comparison</Badge>
          </CardHeader>
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[1.4fr_1fr_1fr] bg-slate-50 text-xs font-semibold uppercase tracking-wide text-muted">
              <div className="px-4 py-2.5">Area</div>
              <div className="px-4 py-2.5">Without Kosh</div>
              <div className="px-4 py-2.5">With Kosh</div>
            </div>
            {data.comparison.map((c, i) => (
              <div key={i} className="grid grid-cols-[1.4fr_1fr_1fr] items-center border-t border-slate-50 text-sm">
                <div className="px-4 py-3 font-medium text-ink">{c.label}</div>
                <div className="flex items-center gap-1.5 px-4 py-3 text-muted">
                  <X className="h-3.5 w-3.5 shrink-0 text-danger/70" /> {c.without}
                </div>
                <div className="flex items-center gap-1.5 px-4 py-3 font-medium text-ink">
                  <Check className="h-3.5 w-3.5 shrink-0 text-success" /> {c.with_kosh}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Hours chart */}
        <Card>
          <CardHeader><CardTitle>Monthly ops hours</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.bars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="metric" axisLine={false} tickLine={false} fontSize={12} stroke="#94A3B8" />
              <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#94A3B8" width={32} />
              <Bar dataKey="hours" radius={[8, 8, 0, 0]} maxBarSize={90}>
                <Cell fill="#EF4444" />
                <Cell fill="#10B981" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-center text-xs text-muted">
            ~{data.bars[0].hours} hrs of manual ops → under {data.bars[1].hours} hr with Kosh.
          </p>
        </Card>
      </div>

      <p className="text-center text-[11px] text-muted">
        Assumes ₹{data.assumptions.ca_hourly_rate}/hr bookkeeping cost and a {data.assumptions.recovery_uplift_pct}% recovery uplift on
        at-risk receivables — conservative Indian-SMB benchmarks. Figures update with your live data.
      </p>
    </div>
  );
}

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">{icon} {label}</div>
      <div className="mt-1 font-display text-2xl font-extrabold text-ink">{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </Card>
  );
}
