import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, TrendingDown, X, ShieldCheck } from "lucide-react";
import { api, type Anomaly } from "@/lib/api";
import { useLive } from "@/context/LiveContext";
import { cn } from "@/lib/utils";

export function AnomalyBanner() {
  const { pulse } = useLive();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const load = () => api.anomalies().then((r) => alive && setAnomalies(r.anomalies)).catch(() => {});
    load();
    const t = window.setInterval(load, 20000);
    return () => { alive = false; window.clearInterval(t); };
  }, [pulse]);

  const visible = anomalies.filter((a) => !dismissed.has(a.type + a.metric));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {visible.map((a) => {
          const critical = a.severity === "critical";
          const Icon = a.type.includes("drop") ? TrendingDown : AlertTriangle;
          return (
            <motion.div
              key={a.type + a.metric}
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className={cn(
                "flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 shadow-card",
                critical
                  ? "border-red-200 bg-red-50 dark:border-red-500/30"
                  : "border-amber-200 bg-amber-50 dark:border-amber-500/30",
              )}
            >
              <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                critical ? "bg-red-100 text-red-600 dark:bg-red-500/20" : "bg-amber-100 text-amber-600 dark:bg-amber-500/20",
              )}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-bold", critical ? "text-red-700" : "text-amber-700")}>
                    {critical ? "Critical anomaly detected" : "Anomaly detected"}
                  </span>
                  <span className="rounded-md bg-white/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-white/10">
                    z = {a.z_score}
                  </span>
                </div>
                <p className="truncate text-[13px] text-slate-600 dark:text-slate-300">
                  {a.message} · expected {typeof a.expected_value === "number" && a.expected_value < 1 ? `${(a.expected_value * 100).toFixed(1)}%` : a.expected_value}
                </p>
              </div>
              <button
                onClick={() => setDismissed((d) => new Set(d).add(a.type + a.metric))}
                className="shrink-0 text-slate-400 hover:text-slate-600"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Compact "all clear" chip for when no anomalies are present (optional). */
export function AnomalyClear() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <ShieldCheck className="h-3.5 w-3.5 text-success" /> No payment anomalies detected
    </div>
  );
}
