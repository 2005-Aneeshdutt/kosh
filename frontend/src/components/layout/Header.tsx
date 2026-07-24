import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Radio, ChevronDown, LogOut, Play, Pause, Sun, Moon, Menu, Command, Rows3, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import { useRun } from "@/context/RunContext";
import { useLive } from "@/context/LiveContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Your revenue operations, live" },
  "/collections": { title: "Collections", subtitle: "AI-scored receivables & smart reminders" },
  "/autopilot": { title: "Autopilot", subtitle: "Autonomous agents with human-in-the-loop approval" },
  "/strategist": { title: "Strategist", subtitle: "AI advisor — turn your live data into decisions" },
  "/impact": { title: "Impact", subtitle: "What Kosh is worth — with vs. without" },
  "/agents": { title: "Agent Crew", subtitle: "How each agent works — and what it replaces" },
  "/studio": { title: "Agent Studio", subtitle: "Configure, inspect and deploy the crew" },
  "/reconciliation": { title: "Reconciliation", subtitle: "Match settlements to your bank statement" },
  "/forecast": { title: "Cashflow Forecast", subtitle: "7-day outlook with early-warning alerts" },
  "/ledger": { title: "Live Ledger", subtitle: "Real-time transactions · export & Sheets sync" },
  "/audit": { title: "Audit Log", subtitle: "Immutable trail of every agent, human & system action" },
  "/mail": { title: "Email Outbox", subtitle: "Reminders & receipts sent by your agents" },
  "/settings": { title: "Settings", subtitle: "Connection, integrations & agents" },
};

export function Header({ path, onMenu }: { path: string; onMenu?: () => void }) {
  const { running, runAll } = useRun();
  const { connected } = useLive();
  const { user, logout } = useAuth();
  const { theme, density, toggle: toggleTheme, toggleDensity } = useTheme();
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
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 glass px-4 py-4 sm:px-6 lg:px-8 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-brand/40 after:to-transparent">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted transition hover:text-brand lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-lg font-bold text-ink sm:text-xl">{meta.title}</h1>
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                connected ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
              )}
            >
              <Radio className={cn("h-2.5 w-2.5", connected && "animate-glow-pulse")} /> {connected ? "LIVE" : "…"}
            </span>
          </div>
          <p className="hidden text-sm text-muted sm:block">{meta.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* ⌘K command trigger (also the tour anchor). */}
        <button
          data-tour="palette"
          onClick={() => window.dispatchEvent(new CustomEvent("kosh:open-palette"))}
          className="hidden items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-xs font-medium text-muted transition hover:border-brand/30 hover:text-ink md:flex"
          title="Command palette"
        >
          <Command className="h-3.5 w-3.5" /> Search
          <kbd className="rounded border border-border px-1 py-0.5 text-[10px] font-semibold">⌘K</kbd>
        </button>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("kosh:start-tour"))}
          className="hidden h-9 w-9 items-center justify-center rounded-xl border border-border text-muted transition hover:border-brand/30 hover:text-brand sm:flex"
          title="Take the guided tour"
          aria-label="Guided tour"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        <button
          onClick={toggleDensity}
          className={cn(
            "hidden h-9 w-9 items-center justify-center rounded-xl border transition sm:flex",
            density === "compact" ? "border-brand/30 bg-brand-light text-brand-dark" : "border-border text-muted hover:border-brand/30 hover:text-brand",
          )}
          title={density === "compact" ? "Comfortable density" : "Compact density"}
          aria-label="Toggle density"
        >
          <Rows3 className="h-4 w-4" />
        </button>

        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted transition hover:border-brand/30 hover:text-brand"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle color theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          onClick={toggleSim}
          className={cn(
            "hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition md:flex",
            simOn ? "border-brand/30 bg-brand-light text-brand-dark" : "border-border text-muted hover:bg-slate-50"
          )}
          title="Toggle the live payment simulator"
        >
          {simOn ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {simOn ? "Live feed on" : "Feed paused"}
        </button>

        <Button data-tour="run" size="lg" onClick={runAll} disabled={running} className="px-3 sm:px-5">
          {running ? <><Loader2 className="h-4 w-4 animate-spin" /> <span className="hidden sm:inline">Agents working…</span></> : <><Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Run All Agents</span></>}
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
