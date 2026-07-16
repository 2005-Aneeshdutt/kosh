import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  FileCheck2,
  TrendingUp,
  Settings,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/collections", label: "Collections", icon: Wallet },
  { to: "/reconciliation", label: "Reconciliation", icon: FileCheck2 },
  { to: "/forecast", label: "Forecast", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: Settings },
];

const AGENTS = [
  { name: "Collect", color: "bg-collect", desc: "Chases receivables" },
  { name: "Recon", color: "bg-recon", desc: "Matches settlements" },
  { name: "Oracle", color: "bg-oracle", desc: "Forecasts cashflow" },
  { name: "Pulse", color: "bg-pulse", desc: "Monitors payments" },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col bg-ink text-slate-300">
      <div className="flex items-center gap-3 px-6 py-6">
        <img src="/kosh-logo.svg" alt="Kosh" className="h-9 w-9" />
        <div>
          <div className="text-lg font-extrabold tracking-tight text-white">Kosh</div>
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-8 px-6">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <Bot className="h-3.5 w-3.5" /> Agent Crew
        </div>
        <div className="space-y-3">
          {AGENTS.map((a) => (
            <div key={a.name} className="flex items-start gap-2.5">
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", a.color)} />
              <div>
                <div className="text-[13px] font-semibold text-slate-200">{a.name}</div>
                <div className="text-[11px] text-slate-500">{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto px-6 py-5 text-[11px] text-slate-500">
        Built on the Razorpay ecosystem
        <br />
        &amp; Claude Agent SDK
      </div>
    </aside>
  );
}
