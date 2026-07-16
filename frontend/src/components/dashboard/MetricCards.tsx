import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/primitives";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { formatPaisa } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MetricCard as MetricCardType } from "@/lib/api";

const ACCENT: Record<string, string> = {
  revenue: "#3395FF",
  success_rate: "#10B981",
  outstanding: "#F59E0B",
  forecast: "#8B5CF6",
};

function formatterFor(key: string) {
  if (key === "success_rate") return (n: number) => `${n.toFixed(1)}%`;
  return (n: number) => formatPaisa(n);
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={points} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#spark-${color})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MetricCards({ cards, liveKey }: { cards: MetricCardType[]; liveKey?: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => {
        const color = ACCENT[c.key] ?? "#3395FF";
        const up = c.trend_direction === "up";
        const pulsing = liveKey === c.key;
        return (
          <Card key={c.key} className={cn("relative overflow-hidden p-5 transition-shadow", pulsing && "shadow-glow")}>
            <div className="absolute right-0 top-0 h-16 w-16 rounded-full opacity-[0.06] blur-2xl" style={{ background: color }} />
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{c.label}</div>
            <div className="mt-1.5 flex items-end justify-between">
              <AnimatedCounter
                value={c.value}
                format={formatterFor(c.key)}
                className="font-display text-2xl font-extrabold tracking-tight text-ink tabular"
              />
              <div className={cn("flex items-center gap-0.5 text-xs font-semibold", up ? "text-success" : "text-danger")}>
                {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {Math.abs(c.trend_pct)}%
              </div>
            </div>
            <div className="mt-3">
              <Sparkline data={c.sparkline.length ? c.sparkline : [0, 0]} color={color} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
