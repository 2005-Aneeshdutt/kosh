import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, LayoutDashboard, Wallet, Plane, Compass, TrendingUp, Boxes, Network,
  FileCheck2, LineChart, Table, Mail, Settings as SettingsIcon, ScrollText,
  Sparkles, Sun, Moon, Rows3, MessageSquare, CornerDownLeft, Zap,
} from "lucide-react";
import { useRun } from "@/context/RunContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  group: "Navigate" | "Actions" | "Ask Copilot";
  icon: typeof Search;
  keywords?: string;
  run: () => void;
};

export function CommandPalette() {
  const navigate = useNavigate();
  const { runAll } = useRun();
  const { theme, toggle: toggleTheme, toggleDensity } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("kosh:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("kosh:open-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const askCopilot = (send: string) =>
    window.dispatchEvent(new CustomEvent("kosh:open-chat", { detail: { send } }));

  const commands: Cmd[] = useMemo(() => {
    const go = (to: string) => () => { navigate(to); setOpen(false); };
    const nav = (id: string, label: string, to: string, icon: typeof Search, keywords = ""): Cmd =>
      ({ id, label, group: "Navigate", icon, keywords, run: go(to) });
    return [
      nav("nav-dash", "Dashboard", "/", LayoutDashboard, "home overview metrics"),
      nav("nav-coll", "Collections", "/collections", Wallet, "debtors reminders overdue receivables"),
      nav("nav-auto", "Autopilot", "/autopilot", Plane, "approvals proposals autonomous"),
      nav("nav-strat", "Strategist", "/strategist", Compass, "advisor recommendations"),
      nav("nav-impact", "Impact", "/impact", TrendingUp, "roi value with without"),
      nav("nav-crew", "Agent Crew", "/agents", Network, "agents flow before after"),
      nav("nav-studio", "Agent Studio", "/studio", Boxes, "configure deploy graph"),
      nav("nav-recon", "Reconciliation", "/reconciliation", FileCheck2, "settlements bank match"),
      nav("nav-fore", "Cashflow Forecast", "/forecast", LineChart, "predict inflow outflow"),
      nav("nav-ledger", "Live Ledger", "/ledger", Table, "transactions export sheets"),
      nav("nav-audit", "Audit Log", "/audit", ScrollText, "activity trail history timeline"),
      nav("nav-mail", "Email Outbox", "/mail", Mail, "reminders receipts sent"),
      nav("nav-set", "Settings", "/settings", SettingsIcon, "integrations connection"),
      { id: "act-run", label: "Run all agents", hint: "kick off the crew", group: "Actions", icon: Sparkles, keywords: "deploy pipeline execute", run: () => { runAll(); setOpen(false); } },
      { id: "act-theme", label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode", group: "Actions", icon: theme === "dark" ? Sun : Moon, keywords: "theme dark light appearance", run: () => { toggleTheme(); setOpen(false); } },
      { id: "act-density", label: "Toggle compact density", group: "Actions", icon: Rows3, keywords: "spacing comfortable compact", run: () => { toggleDensity(); setOpen(false); } },
      { id: "act-chat", label: "Open Copilot", group: "Actions", icon: MessageSquare, keywords: "assistant ai chat", run: () => { window.dispatchEvent(new CustomEvent("kosh:open-chat")); setOpen(false); } },
      { id: "ask-how", label: "How are we doing?", group: "Ask Copilot", icon: Zap, keywords: "health revenue status", run: () => { askCopilot("How are we doing?"); setOpen(false); } },
      { id: "ask-over", label: "Who's overdue?", group: "Ask Copilot", icon: Zap, keywords: "debtors collections", run: () => { askCopilot("Who's overdue?"); setOpen(false); } },
      { id: "ask-pay", label: "Pay the biggest overdue invoice", group: "Ask Copilot", icon: Zap, keywords: "collect payment", run: () => { askCopilot("Pay the biggest overdue invoice"); setOpen(false); } },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, runAll, theme, toggleTheme, toggleDensity]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => { setActive(0); }, [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); filtered[active]?.run(); }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Group while preserving order.
  const groups = useMemo(() => {
    const map = new Map<string, { cmd: Cmd; idx: number }[]>();
    filtered.forEach((cmd, idx) => {
      const arr = map.get(cmd.group) ?? [];
      arr.push({ cmd, idx });
      map.set(cmd.group, arr);
    });
    return [...map.entries()];
  }, [filtered]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-navy-950/50 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-pop ring-1 ring-black/5"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="h-4.5 w-4.5 shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search pages, actions, or ask the Copilot…"
                className="w-full bg-transparent py-4 text-sm text-ink outline-none placeholder:text-muted"
              />
              <kbd className="hidden shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted sm:block">ESC</kbd>
            </div>

            <div ref={listRef} className="scroll-thin max-h-[52vh] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-muted">No matches for "{query}"</div>
              )}
              {groups.map(([group, items]) => (
                <div key={group} className="mb-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">{group}</div>
                  {items.map(({ cmd, idx }) => {
                    const Icon = cmd.icon;
                    const isActive = idx === active;
                    return (
                      <button
                        key={cmd.id}
                        data-idx={idx}
                        onMouseMove={() => setActive(idx)}
                        onClick={() => cmd.run()}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                          isActive ? "bg-brand-gradient text-white" : "text-ink hover:bg-slate-50",
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-muted")} />
                        <span className="flex-1 font-medium">{cmd.label}</span>
                        {cmd.hint && <span className={cn("text-xs", isActive ? "text-white/80" : "text-muted")}>{cmd.hint}</span>}
                        {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-white/80" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border bg-slate-50 px-4 py-2 text-[11px] text-muted">
              <span className="flex items-center gap-2">
                <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-semibold">↑↓</kbd> navigate
                <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-semibold">↵</kbd> select
              </span>
              <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-brand" /> Kosh Command</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
