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
import { Card, CardHeader, CardTitle } from "@/components/ui/primitives";
import { formatPaisaCompact, formatPaisa } from "@/lib/format";
import type { ForecastResponse } from "@/lib/api";

export function CashflowForecast({ data }: { data: ForecastResponse }) {
  const rows = data.days.map((d) => ({
    date: d.date.slice(5),
    history: d.is_history ? d.net_position : null,
    forecast: d.is_history ? null : d.net_position,
    is_history: d.is_history,
  }));

  // Bridge the two series so the line is continuous at the seam.
  const lastHistoryIdx = rows.map((r) => r.is_history).lastIndexOf(true);
  if (lastHistoryIdx >= 0 && lastHistoryIdx < rows.length) {
    rows[lastHistoryIdx].forecast = rows[lastHistoryIdx].history;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cashflow Forecast</CardTitle>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-brand" /> Actual
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-oracle" /> Predicted
          </span>
        </div>
      </CardHeader>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.18} />
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
            formatter={(v: number) => [formatPaisa(v), "Net position"]}
            contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
          />
          <ReferenceLine y={0} stroke="#E2E8F0" />
          <Area
            type="monotone"
            dataKey="forecast"
            stroke="#8B5CF6"
            strokeWidth={2}
            strokeDasharray="5 4"
            fill="url(#fc-fill)"
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="history"
            stroke="#3B82F6"
            strokeWidth={2.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
