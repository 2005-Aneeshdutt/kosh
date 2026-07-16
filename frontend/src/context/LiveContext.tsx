import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { subscribeLive, type LiveEvent, type PaymentRow } from "@/lib/api";
import { formatPaisa } from "@/lib/format";

interface LiveValue {
  events: LiveEvent[];
  livePayments: PaymentRow[];
  lastMetrics: { success_rate: number; total_revenue: number; payment_count: number } | null;
  /** bumps whenever business state changes, so pages can refetch. */
  pulse: number;
  connected: boolean;
}

const LiveContext = createContext<LiveValue | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [livePayments, setLivePayments] = useState<PaymentRow[]>([]);
  const [lastMetrics, setLastMetrics] = useState<LiveValue["lastMetrics"]>(null);
  const [pulse, setPulse] = useState(0);
  const [connected, setConnected] = useState(false);
  const throttle = useRef(0);

  useEffect(() => {
    const unsub = subscribeLive((e) => {
      setConnected(true);
      setEvents((prev) => [...prev.slice(-80), e]);

      if (e.kind === "payment") {
        const p = e.data as PaymentRow;
        setLivePayments((prev) => [p, ...prev].slice(0, 40));
        if (p.status === "captured" && p.source === "checkout") {
          toast.success(`Payment received · ${formatPaisa(p.amount)} from ${p.customer_name}`);
        }
        // throttle refetch pulses to avoid hammering endpoints
        const now = Date.now();
        if (now - throttle.current > 900) {
          throttle.current = now;
          setPulse((v) => v + 1);
        }
      } else if (e.kind === "metrics") {
        setLastMetrics(e.data as LiveValue["lastMetrics"]);
      } else if (e.kind === "invoice_paid") {
        setPulse((v) => v + 1);
        toast.success(`Invoice ${e.data.id} settled · ${formatPaisa(e.data.amount)}`);
      } else if (e.kind === "email") {
        // surface delivered reminders/receipts subtly
        if (e.data.kind === "receipt") { /* receipt toast handled by payment */ }
      }
    });
    return unsub;
  }, []);

  return (
    <LiveContext.Provider value={{ events, livePayments, lastMetrics, pulse, connected }}>
      {children}
    </LiveContext.Provider>
  );
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive must be used within LiveProvider");
  return ctx;
}
