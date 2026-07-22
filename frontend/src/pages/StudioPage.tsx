import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet, FileCheck2, TrendingUp, Activity, Cpu, Sparkles, Loader2, ChevronDown,
  Wrench, Database, GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, Badge, Button } from "@/components/ui/primitives";
import { AgentFlow } from "@/components/agents/AgentFlow";
import { api, type StudioConfig } from "@/lib/api";
import { useRun } from "@/context/RunContext";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Wallet> = {
  collect: Wallet, recon: FileCheck2, oracle: TrendingUp, pulse: Activity,
};

export function StudioPage() {
  const { runAll, running } = useRun();
  const [cfg, setCfg] = useState<StudioConfig | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { api.studioConfig().then(setCfg).catch(() => {}); }, []);

  async function toggle(key: string, enabled: boolean) {
    setBusy(key);
    try { setCfg(await api.studioToggle(key, enabled)); toast.info(`${key} ${enabled ? "enabled" : "disabled"}`); }
    catch { toast.error("Could not update"); }
    finally { setBusy(null); }
  }

  if (!cfg) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-navy-900 text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" />
              <h2 className="font-display text-lg font-bold">Agent Studio</h2>
            </div>
            <p className="mt-1 text-sm text-slate-300">Configure, inspect and deploy the Kosh agent crew.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1"><Cpu className="h-3 w-3 text-brand" /> {cfg.model}</span>
              <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1"><GitBranch className="h-3 w-3 text-oracle" /> {cfg.orchestrator}</span>
              <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 capitalize">provider: {cfg.provider}</span>
            </div>
          </div>
          <Button size="lg" onClick={runAll} disabled={running}>
            {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Running…</> : <><Sparkles className="h-4 w-4" /> Deploy &amp; run crew</>}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.1fr]">
        {/* Graph */}
        <Card>
          <CardHeader><CardTitle>Execution graph</CardTitle><Badge variant="purple">LangGraph</Badge></CardHeader>
          <StudioGraph cfg={cfg} />
        </Card>

        {/* Live pipeline (animates on deploy) */}
        <AgentFlow />
      </div>

      {/* Agent config cards */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Crew configuration</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {cfg.agents.map((a) => {
            const Icon = ICONS[a.key] ?? Wallet;
            const open = expanded === a.key;
            return (
              <Card key={a.key} className={cn("p-4 transition-all", !a.enabled && "opacity-60")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl p-2 text-white" style={{ background: a.color }}><Icon className="h-5 w-5" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{a.name}</span>
                        <Badge variant={a.enabled ? "success" : "default"}>{a.enabled ? "enabled" : "disabled"}</Badge>
                      </div>
                      <div className="text-xs text-muted">{a.description}</div>
                    </div>
                  </div>
                  {/* toggle */}
                  <button
                    onClick={() => toggle(a.key, !a.enabled)}
                    disabled={busy === a.key}
                    className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", a.enabled ? "bg-brand" : "bg-slate-300")}
                  >
                    <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform", a.enabled ? "translate-x-5" : "translate-x-0.5")} />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {a.tools.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-600">
                      <Wrench className="h-2.5 w-2.5" /> {t}
                    </span>
                  ))}
                </div>

                <button onClick={() => setExpanded(open ? null : a.key)} className="mt-3 flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} /> System prompt
                </button>
                {open && (
                  <motion.pre initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-emerald-200">
                    {a.system}
                  </motion.pre>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StudioGraph({ cfg }: { cfg: StudioConfig }) {
  const enabledMap = Object.fromEntries(cfg.agents.map((a) => [a.node, a.enabled]));
  const nodeColor = (id: string) => cfg.agents.find((a) => a.node === id)?.color ?? "#64748B";
  const on = (id: string) => enabledMap[id] !== false;

  const Node = ({ id, label, kind }: { id: string; label: string; kind: string }) => (
    <div className={cn(
      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
      kind === "system" ? "border-border bg-slate-50 text-ink" : on(id) ? "border-transparent bg-white shadow-sm" : "border-dashed border-border bg-slate-50/50 text-muted line-through",
    )} style={kind === "agent" && on(id) ? { boxShadow: `0 0 0 1.5px ${nodeColor(id)}30` } : undefined}>
      {kind === "system" ? <Database className="h-3.5 w-3.5 text-muted" /> : <span className="h-2 w-2 rounded-full" style={{ background: on(id) ? nodeColor(id) : "#CBD5E1" }} />}
      {label}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <Node id="fetch_data" label="Fetch data" kind="system" />
      <div className="h-4 w-px bg-slate-200" />
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">parallel fan-out</div>
      <div className="flex flex-wrap justify-center gap-2">
        <Node id="pulse" label="Pulse" kind="agent" />
        <Node id="oracle" label="Oracle" kind="agent" />
        <Node id="collect" label="Collect" kind="agent" />
      </div>
      <div className="h-4 w-px bg-slate-200" />
      <Node id="recon" label="Recon" kind="agent" />
      <div className="h-4 w-px bg-slate-200" />
      <Node id="summarize" label="Summary" kind="system" />
    </div>
  );
}
