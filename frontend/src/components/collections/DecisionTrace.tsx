import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Brain, Database, Scale, Lightbulb, Loader2, ArrowRight } from "lucide-react";
import { api, type DecisionTrace as Trace } from "@/lib/api";
import { formatPaisa } from "@/lib/format";
import { cn } from "@/lib/utils";

const BAND_COLOR: Record<string, string> = {
  critical: "text-red-600 bg-red-50",
  high: "text-amber-600 bg-amber-50",
  medium: "text-blue-600 bg-blue-50",
  low: "text-emerald-600 bg-emerald-50",
};

export function DecisionTrace({ invoiceId, onClose }: { invoiceId: string | null; onClose: () => void }) {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!invoiceId) { setTrace(null); return; }
    setLoading(true);
    api.explainDebtor(invoiceId).then(setTrace).catch(() => setTrace(null)).finally(() => setLoading(false));
  }, [invoiceId]);

  return (
    <AnimatePresence>
      {invoiceId && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[55] flex items-center justify-center bg-navy-950/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-pop"
          >
            <div className="relative overflow-hidden bg-navy-gradient px-6 py-5 text-white">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/20 blur-3xl" />
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-brand" />
                  <div>
                    <div className="font-display text-base font-bold">Why this decision?</div>
                    <div className="text-[11px] text-slate-400">Explainable AI · risk scoring trace</div>
                  </div>
                </div>
                <button onClick={onClose} className="text-slate-300 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
            </div>

            {loading || !trace ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Tracing the decision…
              </div>
            ) : (
              <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6 scroll-thin">
                {/* Inputs */}
                <Section icon={Database} label="Inputs">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Stat k="Customer" v={trace.customer_name} />
                    <Stat k="Amount" v={formatPaisa(trace.amount)} />
                    <Stat k="Overdue" v={`${trace.days_overdue}d`} />
                  </div>
                </Section>

                {/* Scoring */}
                <Section icon={Scale} label="Risk scoring">
                  <div className="space-y-2.5">
                    {trace.factors.map((f) => (
                      <div key={f.label}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-ink">{f.label}</span>
                          <span className="text-muted">
                            {f.value} · weight {Math.round(f.weight * 100)}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${f.signal * 100}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full rounded-full bg-brand-gradient"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className="text-xs font-medium text-muted">Composite risk score</span>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-extrabold tabular text-ink">{(trace.risk_score * 100).toFixed(0)}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold uppercase", BAND_COLOR[trace.risk_band])}>
                        {trace.risk_band}
                      </span>
                    </div>
                  </div>
                </Section>

                {/* Decision */}
                <Section icon={Lightbulb} label="Recommended action">
                  <div className="flex items-start gap-2 rounded-xl border border-brand/20 bg-brand-light/60 px-3 py-3 text-sm text-ink dark:bg-brand/10">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <span>{trace.recommendation}</span>
                  </div>
                </Section>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ icon: Icon, label, children }: { icon: typeof Database; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      {children}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{k}</div>
      <div className="mt-0.5 truncate text-sm font-bold text-ink" title={v}>{v}</div>
    </div>
  );
}
