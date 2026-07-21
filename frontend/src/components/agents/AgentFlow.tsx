import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Database, Wallet, FileCheck2, TrendingUp, Activity, Sparkles, Check, Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/primitives";
import { useRun } from "@/context/RunContext";
import { cn } from "@/lib/utils";
import type { AgentEvent } from "@/lib/api";

type Status = "idle" | "pending" | "active" | "done";

const NODE_META: Record<string, { name: string; icon: typeof Wallet; ring: string; dot: string }> = {
  fetch: { name: "Fetch data", icon: Database, ring: "ring-ink/30", dot: "bg-ink" },
  pulse: { name: "Pulse", icon: Activity, ring: "ring-pulse/40", dot: "bg-pulse" },
  oracle: { name: "Oracle", icon: TrendingUp, ring: "ring-oracle/40", dot: "bg-oracle" },
  collect: { name: "Collect", icon: Wallet, ring: "ring-collect/40", dot: "bg-collect" },
  recon: { name: "Recon", icon: FileCheck2, ring: "ring-recon/40", dot: "bg-recon" },
  summary: { name: "Summary", icon: Sparkles, ring: "ring-brand/40", dot: "bg-brand" },
};

function latestMessage(evs: AgentEvent[]): string {
  return evs.length ? evs[evs.length - 1].message : "";
}

export function AgentFlow() {
  const { events, running } = useRun();

  // Scope to the current run — the activation event carries a run_id.
  const runEvents = useMemo(() => {
    let start = -1;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].metadata?.run_id) { start = i; break; }
    }
    return start >= 0 ? events.slice(start) : [];
  }, [events]);

  const byAgent = (a: string) => runEvents.filter((e) => e.agent_name === a);
  const orch = byAgent("orchestrator");
  const anyAgentStarted = ["pulse", "oracle", "collect", "recon"].some((a) => byAgent(a).length > 0);
  const fetchDone = orch.some((e) => /Loaded/.test(e.message)) || anyAgentStarted;
  const summaryDone = orch.some((e) => e.metadata?.final);
  const started = runEvents.length > 0 || running;

  function agentStatus(a: string): Status {
    const evs = byAgent(a);
    if (evs.some((e) => e.event_type === "result")) return "done";
    if (evs.length) return "active";
    return started ? "pending" : "idle";
  }

  const reconStatus = agentStatus("recon");
  const status: Record<string, Status> = {
    fetch: fetchDone ? "done" : running ? "active" : started ? "pending" : "idle",
    pulse: agentStatus("pulse"),
    oracle: agentStatus("oracle"),
    collect: agentStatus("collect"),
    recon: reconStatus,
    summary: summaryDone ? "done" : reconStatus === "done" && running ? "active" : started ? "pending" : "idle",
  };

  const msg: Record<string, string> = {
    fetch: latestMessage(orch.filter((e) => !e.metadata?.final)),
    pulse: latestMessage(byAgent("pulse")),
    oracle: latestMessage(byAgent("oracle")),
    collect: latestMessage(byAgent("collect")),
    recon: latestMessage(byAgent("recon")),
    summary: latestMessage(orch.filter((e) => e.metadata?.final)),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Pipeline</CardTitle>
        <span className={cn("flex items-center gap-1.5 text-xs font-medium", running ? "text-brand" : "text-muted")}>
          <span className={cn("h-2 w-2 rounded-full", running ? "animate-pulse-ring bg-brand" : summaryDone ? "bg-success" : "bg-slate-300")} />
          {running ? "Running" : summaryDone ? "Completed" : "Idle"}
        </span>
      </CardHeader>

      <div className="flex flex-col items-center gap-2">
        <Node k="fetch" status={status.fetch} msg={msg.fetch} />
        <Connector on={status.fetch === "done"} />

        {/* Parallel fan-out */}
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">parallel</div>
        <div className="grid w-full grid-cols-3 gap-3">
          <Node k="pulse" status={status.pulse} msg={msg.pulse} />
          <Node k="oracle" status={status.oracle} msg={msg.oracle} />
          <Node k="collect" status={status.collect} msg={msg.collect} />
        </div>

        <Connector on={["pulse", "oracle", "collect"].every((a) => status[a] === "done")} />
        <Node k="recon" status={status.recon} msg={msg.recon} />
        <Connector on={status.recon === "done"} />
        <Node k="summary" status={status.summary} msg={msg.summary} />
      </div>
    </Card>
  );
}

function Node({ k, status, msg }: { k: string; status: Status; msg: string }) {
  const meta = NODE_META[k];
  const Icon = meta.icon;
  return (
    <motion.div
      layout
      className={cn(
        "flex w-full max-w-md items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-all",
        status === "active" && cn("border-transparent bg-white ring-2 shadow-glow", meta.ring),
        status === "done" && "border-success/30 bg-emerald-50/40",
        status === "pending" && "border-dashed border-border bg-slate-50/40 opacity-70",
        status === "idle" && "border-border bg-slate-50/30 opacity-50",
      )}
    >
      <div className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white",
        status === "done" ? "bg-success" : status === "active" ? meta.dot : "bg-slate-300",
      )}>
        {status === "active" ? <Loader2 className="h-4 w-4 animate-spin" /> :
         status === "done" ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink">{meta.name}</div>
        <div className="truncate text-[11px] text-muted">
          {status === "active" || status === "done" ? (msg || "…") :
           status === "pending" ? "queued" : "idle"}
        </div>
      </div>
    </motion.div>
  );
}

function Connector({ on }: { on: boolean }) {
  return (
    <div className="relative h-5 w-0.5 overflow-hidden rounded-full bg-slate-200">
      {on && (
        <motion.div
          initial={{ y: "-100%" }}
          animate={{ y: "100%" }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-b from-transparent via-brand to-transparent"
        />
      )}
    </div>
  );
}
