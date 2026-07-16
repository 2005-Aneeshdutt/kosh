import { useEffect, useState } from "react";
import { Wallet, FileCheck2, TrendingUp, Activity } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { api, type AgentStatus } from "@/lib/api";
import { useRun } from "@/context/RunContext";
import { cn } from "@/lib/utils";

const META: Record<string, { icon: typeof Wallet; accent: string; ring: string }> = {
  collect: { icon: Wallet, accent: "text-collect", ring: "ring-collect/30" },
  recon: { icon: FileCheck2, accent: "text-recon", ring: "ring-recon/30" },
  oracle: { icon: TrendingUp, accent: "text-oracle", ring: "ring-oracle/30" },
  pulse: { icon: Activity, accent: "text-pulse", ring: "ring-pulse/30" },
};

const STATUS_LABEL: Record<string, string> = {
  idle: "Idle",
  active: "Working…",
  done: "Complete",
  error: "Error",
};

export function AgentCards() {
  const { runVersion, running } = useRun();
  const [statuses, setStatuses] = useState<AgentStatus[]>([]);

  useEffect(() => {
    const load = () => api.agentStatus().then(setStatuses).catch(() => {});
    load();
    const t = window.setInterval(load, running ? 1500 : 8000);
    return () => window.clearInterval(t);
  }, [runVersion, running]);

  const ordered: AgentStatus[] = ["collect", "recon", "oracle", "pulse"].map(
    (n) =>
      statuses.find((s) => s.name === n) ?? {
        name: n,
        label: n,
        status: "idle",
        actions_taken: 0,
        summary: null,
        last_run: null,
      }
  );

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {ordered.map((s) => {
        const meta = META[s.name] ?? META.collect;
        const Icon = meta.icon;
        const active = s.status === "active";
        return (
          <Card
            key={s.name}
            className={cn(
              "p-4 transition-all",
              active && cn("ring-2", meta.ring)
            )}
          >
            <div className="flex items-center justify-between">
              <div className={cn("rounded-xl bg-slate-50 p-2", meta.accent)}>
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  s.status === "done" && "text-success",
                  s.status === "active" && "text-brand",
                  s.status === "idle" && "text-slate-400",
                  s.status === "error" && "text-danger"
                )}
              >
                {STATUS_LABEL[s.status]}
              </span>
            </div>
            <div className="mt-3 text-sm font-bold text-ink">{s.label ?? s.name}</div>
            <div className="text-xs text-muted">{s.summary ?? "Ready"}</div>
          </Card>
        );
      })}
    </div>
  );
}
