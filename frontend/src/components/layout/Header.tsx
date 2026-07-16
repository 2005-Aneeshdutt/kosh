import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Radio, ChevronDown, LogOut, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import { useRun } from "@/context/RunContext";
import { useLive } from "@/context/LiveContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Your revenue operations, live" },
  "/collections": { title: "Collections", subtitle: "AI-scored receivables & smart reminders" },
  "/autopilot": { title: "Autopilot", subtitle: "Autonomous agents with human-in-the-loop approval" },
  "/reconciliation": { title: "Reconciliation", subtitle: "Match settlements to your bank statement" },
  "/forecast": { title: "Cashflow Forecast", subtitle: "7-day outlook with early-warning alerts" },
  "/ledger": { title: "Live Ledger", subtitle: "Real-time transactions · export & Sheets sync" },
  "/mail": { title: "Email Outbox", subtitle: "Reminders & receipts sent by your agents" },
  "/settings": { title: "Settings", subtitle: "Connection, integrations & agents" },
};

export function Header({ path }: { path: string }) {
  const { running, runAll } = useRun();
  const { connected } = useLive();
  const { user, logout } = useAuth();
  const [demo, setDemo] = useState(true);
  const [simOn, setSimOn] = useState(true);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.razorpayStatus().then((s) => setDemo(s.demo_mode)).catch(() => {});
    api.simulatorStatus().then((s) => setSimOn(s.running)).catch(() => {});
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function toggleSim() {
    const next = !simOn;
    setSimOn(next);
    await api.simulator(next ? "start" : "stop").catch(() => {});
    toast.info(next ? "Live payment stream resumed" : "Live payment stream paused");
  }

  const meta = TITLES[path] ?? TITLES["/"];

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border glass px-8 py-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-bold text-ink">{meta.title}</h1>
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              connected ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
            )}
          >
            <Radio className="h-2.5 w-2.5" /> {connected ? "LIVE" : "…"}
          </span>
        </div>
        <p className="text-sm text-muted">{meta.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleSim}
          className={cn(
            "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition",
            simOn ? "border-brand/30 bg-brand-light text-brand-dark" : "border-border text-muted hover:bg-slate-50"
          )}
          title="Toggle the live payment simulator"
        >
          {simOn ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {simOn ? "Live feed on" : "Feed paused"}
        </button>

        <Button size="lg" onClick={runAll} disabled={running}>
          {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Agents working…</> : <><Sparkles className="h-4 w-4" /> Run All Agents</>}
        </Button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenu((m) => !m)}
            className="flex items-center gap-2 rounded-xl border border-border bg-white px-2.5 py-1.5 hover:bg-slate-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-xs font-bold text-white">
              {user?.avatar ?? "?"}
            </span>
            <div className="hidden text-left md:block">
              <div className="text-xs font-bold text-ink">{user?.name}</div>
              <div className="text-[10px] text-muted">{demo ? "Demo workspace" : "Live workspace"}</div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted" />
          </button>
          {menu && (
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-white shadow-pop">
              <div className="border-b border-border px-4 py-3">
                <div className="text-sm font-bold text-ink">{user?.name}</div>
                <div className="text-xs text-muted">{user?.email}</div>
                <div className="mt-1 text-[11px] font-medium text-brand">{user?.role} · {user?.merchant}</div>
              </div>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-danger hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
