import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, Loader2, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/primitives";
import { useRun } from "@/context/RunContext";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentEvent } from "@/lib/api";

const AGENT_META: Record<string, { color: string; dot: string; label: string }> = {
  collect: { color: "text-collect", dot: "bg-collect", label: "Collect" },
  recon: { color: "text-recon", dot: "bg-recon", label: "Recon" },
  oracle: { color: "text-oracle", dot: "bg-oracle", label: "Oracle" },
  pulse: { color: "text-pulse", dot: "bg-pulse", label: "Pulse" },
  orchestrator: { color: "text-ink", dot: "bg-ink", label: "Kosh" },
};

function EventIcon({ type }: { type: AgentEvent["event_type"] }) {
  if (type === "thinking")
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />;
  if (type === "action") return <Zap className="h-3.5 w-3.5 text-brand" />;
  if (type === "error") return <X className="h-3.5 w-3.5 text-danger" />;
  return <Check className="h-3.5 w-3.5 text-success" />;
}

export function AgentActivityFeed({ className }: { className?: string }) {
  const { events, running } = useRun();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader>
        <CardTitle>Agent Activity</CardTitle>
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            running ? "text-brand" : "text-muted"
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              running ? "animate-pulse-ring bg-brand" : "bg-slate-300"
            )}
          />
          {running ? "Live" : "Idle"}
        </span>
      </CardHeader>

      <div
        ref={scrollRef}
        className="scroll-thin -mr-2 flex-1 space-y-3 overflow-y-auto pr-2"
        style={{ maxHeight: 420 }}
      >
        {events.length === 0 && (
          <div className="flex h-full min-h-[120px] flex-col items-center justify-center text-center text-sm text-muted">
            <Zap className="mb-2 h-6 w-6 text-slate-300" />
            Click <span className="font-semibold text-ink">&nbsp;Run All Agents&nbsp;</span> to
            watch the crew work in real time.
          </div>
        )}
        <AnimatePresence initial={false}>
          {events.map((e, i) => {
            const meta = AGENT_META[e.agent_name] ?? AGENT_META.orchestrator;
            return (
              <motion.div
                key={`${e.timestamp}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex gap-3"
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", meta.dot)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-semibold", meta.color)}>{meta.label}</span>
                    <EventIcon type={e.event_type} />
                    <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                      {timeAgo(e.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{e.message}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Card>
  );
}
