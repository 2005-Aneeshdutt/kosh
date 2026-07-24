import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/primitives";
import { formatPaisaCompact, formatPaisa } from "@/lib/format";
import { tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "@/lib/chart";
import type { ARAgingResponse } from "@/lib/api";

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444"];

export function ARAgingChart({ data }: { data: ARAgingResponse }) {
  const rows = data.buckets.map((b, i) => ({
    name: `${b.bucket}d`,
    amount: b.amount,
    count: b.count,
    color: COLORS[i],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts Receivable Aging</CardTitle>
        <span className="text-sm font-semibold text-ink">
          {formatPaisa(data.total_outstanding)} outstanding
        </span>
      </CardHeader>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} stroke="#94A3B8" />
          <YAxis
            axisLine={false}
            tickLine={false}
            fontSize={12}
            stroke="#94A3B8"
            tickFormatter={(v) => formatPaisaCompact(v)}
            width={56}
          />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
            formatter={(v: number, _n, p) => [
              `${formatPaisa(v)} · ${p.payload.count} invoice(s)`,
              "Outstanding",
            ]}
            contentStyle={tooltipContentStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={64}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
