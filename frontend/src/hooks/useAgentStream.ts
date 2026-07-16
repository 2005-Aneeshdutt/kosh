import { useEffect, useRef, useState, useCallback } from "react";
import { subscribeAgentEvents, type AgentEvent } from "@/lib/api";

/**
 * Live SSE feed of agent events. Keeps a bounded, de-duplicated buffer and
 * exposes whether a run appears to be active (based on start/final markers).
 */
export function useAgentStream(max = 120) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const unsub = subscribeAgentEvents((e) => {
      const key = `${e.timestamp}|${e.agent_name}|${e.message}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);

      if (e.metadata?.run_id) setRunning(true);
      if (e.metadata?.final) setRunning(false);

      setEvents((prev) => {
        const next = [...prev, e];
        return next.length > max ? next.slice(next.length - max) : next;
      });
    });
    return unsub;
  }, [max]);

  const markRunning = useCallback(() => setRunning(true), []);

  return { events, running, markRunning };
}
