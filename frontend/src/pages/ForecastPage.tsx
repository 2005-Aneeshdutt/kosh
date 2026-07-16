import { useEffect, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Info, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { api, type ForecastResponse } from "@/lib/api";
import { formatPaisa, formatPaisaCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRun } from "@/context/RunContext";

const SEV: Record<string, { icon: typeof Info; variant: "warning" | "danger" | "brand"; ring: string }> = {
  info: { icon: Info, variant: "brand", ring: "border-brand/30 bg-blue-50/40" },
  warning: { icon: AlertTriangle, variant: "warning", ring: "border-warning/30 bg-amber-50/40" },
  critical: { icon: AlertTriangle, variant: "danger", ring: "border-danger/30 bg-red-50/40" },
};

export function ForecastPage() {
  const { runVersion } = useRun();
  const [data, setData] = useState<ForecastResponse | null>(null);

  useEffect(() => {
    api.forecast().then(setData).catch(() => {});
  }, [runVersion]);

  if (!data) return null;

  const rows = data.days.map((d) => ({
    date: d.date.slice(5),
    inflow: d.predicted_inflow,
    history: d.is_history ? d.net_position : null,
    forecast: d.is_history ? null : d.net_position,
    is_history: d.is_history,
  }));
  const seam = rows.map((r) => r.is_history).lastIndexOf(true);
  if (seam >= 0) rows[seam].forecast = rows[seam].history;

  const future = data.days.filter((d) => !d.is_history);
  const net7 = future.reduce((s, d) => s + d.net_position, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
            <TrendingUp className="h-4 w-4 text-oracle" /> 7-day net
          </div>
          <div className={cn("mt-1 text-xl font-extrabold", net7 >= 0 ? "text-success" : "text-danger")}>
            {formatPaisa(net7)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Best day inflow</div>
          <div className="mt-1 text-xl font-extrabold text-ink">
            {formatPaisa(Math.max(...future.map((d) => d.predicted_inflow)))}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Avg confidence</div>
          <div className="mt-1 text-xl font-extrabold text-ink">
            {(future.reduce((s, d) => s + d.confidence, 0) / (future.length || 1) * 100).toFixed(0)}%
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Active alerts</div>
          <div className="mt-1 text-xl font-extrabold text-warning">{data.alerts.length}</div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>30-Day History &amp; 7-Day Forecast</CardTitle>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-brand" /> Actual net
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-oracle" /> Predicted net
            </span>
          </div>
        </CardHeader>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fp-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={11} stroke="#94A3B8" />
            <YAxis
              axisLine={false}
              tickLine={false}
              fontSize={11}
              stroke="#94A3B8"
              tickFormatter={(v) => formatPaisaCompact(v)}
              width={56}
            />
            <Tooltip
              formatter={(v: number) => formatPaisa(v)}
              contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke="#E2E8F0" />
            <Area
              type="monotone"
              dataKey="forecast"
              name="Predicted"
              stroke="#8B5CF6"
              strokeWidth={2}
              strokeDasharray="5 4"
              fill="url(#fp-fill)"
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="history"
              name="Actual"
              stroke="#3B82F6"
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Oracle Alerts</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.alerts.map((a, i) => {
            const meta = SEV[a.severity] ?? SEV.info;
            const Icon = meta.icon;
            return (
              <div
                key={i}
                className={cn("flex items-start gap-3 rounded-2xl border p-4", meta.ring)}
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0",
                    a.severity === "critical" && "text-danger",
                    a.severity === "warning" && "text-warning",
                    a.severity === "info" && "text-brand"
                  )}
                />
                <div>
                  <Badge variant={meta.variant}>{a.severity}</Badge>
                  <p className="mt-1.5 text-sm leading-snug text-slate-700">{a.message}</p>
                </div>
              </div>
            );
          })}
          {data.alerts.length === 0 && (
            <Card className="p-4 text-sm text-muted">
              Cashflow looks healthy across the next 7 days — no alerts.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
