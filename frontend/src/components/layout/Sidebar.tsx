import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Wallet, Rocket, Brain, Gauge, FileCheck2, TrendingUp, Table2, Mail, Settings, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLive } from "@/context/LiveContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/collections", label: "Collections", icon: Wallet },
  { to: "/autopilot", label: "Autopilot", icon: Rocket },
  { to: "/strategist", label: "Strategist", icon: Brain },
  { to: "/impact", label: "Impact", icon: Gauge },
  { to: "/reconciliation", label: "Reconciliation", icon: FileCheck2 },
  { to: "/forecast", label: "Forecast", icon: TrendingUp },
  { to: "/ledger", label: "Ledger", icon: Table2 },
  { to: "/mail", label: "Outbox", icon: Mail },
];

const AGENTS = [
  { key: "collect", name: "Collect", color: "bg-collect", desc: "Chases receivables" },
  { key: "recon", name: "Recon", color: "bg-recon", desc: "Matches settlements" },
  { key: "oracle", name: "Oracle", color: "bg-oracle", desc: "Forecasts cashflow" },
  { key: "pulse", name: "Pulse", color: "bg-pulse", desc: "Monitors payments" },
];

export function Sidebar() {
  const { connected } = useLive();
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-navy-900 text-slate-300">
      <div className="flex items-center gap-3 px-6 py-6">
        <img src="/kosh-logo.svg" alt="Kosh" className="h-9 w-9" />
        <div>
          <div className="font-display text-lg font-extrabold tracking-tight text-white">Kosh</div>
          <div className="text-[11px] font-medium text-slate-400">कोष · Revenue Ops</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-brand text-white shadow-glow" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive ? "bg-brand text-white shadow-glow" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
            )
          }
        >
          <Settings className="h-[18px] w-[18px]" /> Settings
        </NavLink>
      </nav>

      <div className="mt-7 px-6">
        <NavLink to="/agents" className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-brand">
          <Bot className="h-3.5 w-3.5" /> Agent Crew <span className="ml-auto text-[9px] font-normal normal-case text-slate-600">see how →</span>
        </NavLink>
        <div className="space-y-1">
          {AGENTS.map((a) => (
            <NavLink
              key={a.name}
              to={`/agents?a=${a.key}`}
              className="group -mx-2 flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
            >
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", a.color)} />
              <div>
                <div className="text-[13px] font-semibold text-slate-200 group-hover:text-white">{a.name}</div>
                <div className="text-[11px] text-slate-500">{a.desc}</div>
              </div>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-3 px-6 py-5">
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-[11px]">
          <span className={cn("h-2 w-2 rounded-full", connected ? "animate-pulse-ring bg-success" : "bg-slate-500")} />
          <span className="text-slate-300">{connected ? "Live stream connected" : "Connecting…"}</span>
        </div>
        <div className="text-[11px] text-slate-500">Razorpay ecosystem · Claude Agent SDK</div>
      </div>
    </aside>
  );
}
