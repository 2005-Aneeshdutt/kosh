import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Brain, Sparkles, ArrowRight, ExternalLink, RefreshCw, Loader2, Send, ChevronRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, Badge, Button } from "@/components/ui/primitives";
import { api, type StrategistBrief, type ChatAction, type ChatCitation } from "@/lib/api";
import { useLive } from "@/context/LiveContext";
import { cn } from "@/lib/utils";

const PRIORITY: Record<string, { variant: "danger" | "warning" | "success"; label: string }> = {
  high: { variant: "danger", label: "High priority" },
  medium: { variant: "warning", label: "Consider" },
  low: { variant: "success", label: "Healthy" },
};

const PROMPTS = [
  "What should I do about my cash position this week?",
  "Which customer is the biggest risk?",
  "How much is overdue right now?",
];

export function StrategistPage() {
  const navigate = useNavigate();
  const { pulse } = useLive();
  const [brief, setBrief] = useState<StrategistBrief | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<{ reply: string; actions: ChatAction[]; citations: ChatCitation[] } | null>(null);

  const load = () => api.strategistBrief().then(setBrief).catch(() => {});
  useEffect(() => { load(); }, [pulse]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }
  function runAction(a: ChatAction) {
    if (a.type === "open_checkout" && a.url) window.open(a.url, "_blank");
    else if (a.type === "navigate" && a.to) navigate(a.to);
  }
  async function ask(text: string) {
    const clean = text.trim();
    if (!clean) return;
    setAsking(true); setAnswer(null); setQ(clean);
    try {
      const res = await api.chat([{ role: "user", content: clean }]);
      setAnswer({ reply: res.reply, actions: res.actions, citations: res.citations ?? [] });
    } catch {
      setAnswer({ reply: "Couldn't reach the backend just now.", actions: [], citations: [] });
    } finally { setAsking(false); }
  }

  return (
    <div className="space-y-6">
      {/* Brief */}
      <Card className="relative overflow-hidden">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-[0.07] blur-2xl" style={{ background: "#6366F1" }} />
        <div className="relative flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy-900 text-white">
            <Brain className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-ink">Strategist</h2>
                <Badge variant="purple">{brief?.llm_authored ? "AI-authored" : "advisory"}</Badge>
              </div>
              <button onClick={refresh} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Re-analyse
              </button>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-700">
              {brief?.headline ?? "Analysing your position…"}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
        {/* Recommendations */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Sparkles className="h-4 w-4 text-brand" /> Recommended moves
          </h3>
          <div className="space-y-3">
            {brief?.recommendations.map((r, i) => {
              const p = PRIORITY[r.priority] ?? PRIORITY.medium;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{r.title}</span>
                          <Badge variant={p.variant}>{p.label}</Badge>
                        </div>
                        <p className="mt-1.5 text-[13px] leading-snug text-slate-600">{r.rationale}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" variant="secondary" onClick={() => runAction(r.action)}>
                        {r.action.type === "open_checkout" ? <ExternalLink className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                        {r.action.label}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Interactive advisor */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Brain className="h-4 w-4 text-oracle" /> Ask the strategist
          </h3>
          <Card className="flex flex-col">
            <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ask a strategic question…"
                className="flex-1 rounded-xl border border-border bg-canvas px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
              <button type="submit" disabled={asking || !q.trim()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-dark disabled:opacity-40">
                {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>

            {!answer && !asking && (
              <div className="mt-3 space-y-1.5">
                {PROMPTS.map((p) => (
                  <button key={p} onClick={() => ask(p)} className="flex w-full items-center justify-between rounded-xl border border-border bg-white px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-brand hover:text-brand-dark">
                    {p} <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            )}

            {answer && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-border bg-slate-50 p-3.5">
                <div className="whitespace-pre-line text-[13px] leading-relaxed text-slate-700">{answer.reply}</div>
                {answer.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {answer.actions.map((a, j) => (
                      <button key={j} onClick={() => runAction(a)} className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand-light px-2.5 py-1.5 text-xs font-semibold text-brand-dark hover:bg-brand/10">
                        {a.type === "open_checkout" ? <ExternalLink className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}{a.label}
                      </button>
                    ))}
                  </div>
                )}
                {answer.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {answer.citations.map((c, j) => (
                      <span key={j} className="rounded-md bg-white px-2 py-1 font-mono text-[10px] text-slate-500" title={c.label}>{c.ref}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
