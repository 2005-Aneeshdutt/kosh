import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api, type AgentEvent } from "@/lib/api";
import { useAgentStream } from "@/hooks/useAgentStream";

interface RunContextValue {
  events: AgentEvent[];
  running: boolean;
  runAll: () => Promise<void>;
  /** Increments whenever a run completes, so pages can refetch. */
  runVersion: number;
}

const RunContext = createContext<RunContextValue | null>(null);

export function RunProvider({ children }: { children: ReactNode }) {
  const { events, running, markRunning } = useAgentStream();
  const [starting, setStarting] = useState(false);
  const [runVersion, setRunVersion] = useState(0);

  const runAll = useCallback(async () => {
    if (running || starting) return;
    setStarting(true);
    markRunning();
    try {
      await api.runAgents();
      toast.info("Kosh crew activated — 4 agents are working…");
      // Give the pipeline time to finish, then bump the refetch version.
      window.setTimeout(() => {
        setRunVersion((v) => v + 1);
        toast.success("All agents completed. Dashboard updated.");
      }, 9000);
    } catch {
      toast.error("Could not start agents. Is the backend running?");
    } finally {
      setStarting(false);
    }
  }, [running, starting, markRunning]);

  return (
    <RunContext.Provider value={{ events, running: running || starting, runAll, runVersion }}>
      {children}
    </RunContext.Provider>
  );
}

export function useRun() {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error("useRun must be used within RunProvider");
  return ctx;
}
