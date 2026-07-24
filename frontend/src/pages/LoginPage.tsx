import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/primitives";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("demo@artisancoffee.in");
  const [password, setPassword] = useState("razorpay");
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left — brand / value prop */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy-gradient p-12 text-white lg:flex">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div
          className="absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-3xl animate-aurora-move"
          style={{ background: "radial-gradient(circle,#3395FF,transparent 70%)" }}
        />
        <div
          className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full opacity-25 blur-3xl animate-aurora-move"
          style={{ background: "radial-gradient(circle,#8B5CF6,transparent 70%)", animationDelay: "-7s" }}
        />

        <div className="relative flex items-center gap-3">
          <img src="/kosh-logo.svg" className="h-10 w-10" alt="Kosh" />
          <div>
            <div className="text-xl font-extrabold tracking-tight">Kosh</div>
            <div className="text-[11px] text-slate-400">कोष · Revenue Operations</div>
          </div>
        </div>

        <div className="relative">
          <h1 className="font-display text-4xl font-extrabold leading-tight">
            The AI revenue<br />
            <span className="text-gradient">copilot</span> for Razorpay<br />merchants.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-400">
            Four autonomous agents collect receivables, reconcile settlements, forecast
            cashflow, and monitor payment health — while you watch it happen live.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { icon: Zap, label: "Real-time payments" },
              { icon: Sparkles, label: "Agentic AI crew" },
              { icon: ShieldCheck, label: "Bank-grade recon" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-slate-200"
              >
                <Icon className="h-4 w-4 text-brand" /> {label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between text-xs text-slate-500">
          <span>Built on the Razorpay ecosystem &amp; the Claude Agent SDK</span>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-glow-pulse" /> 4 agents online
          </span>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex w-full flex-col items-center justify-center bg-canvas px-6 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/kosh-logo.svg" className="h-9 w-9" alt="Kosh" />
            <span className="text-lg font-extrabold text-ink">Kosh</span>
          </div>

          <h2 className="font-display text-2xl font-bold text-ink">Sign in to your dashboard</h2>
          <p className="mt-1 text-sm text-muted">Welcome back. Let your agents get to work.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-3.5 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                placeholder="you@business.in"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-3.5 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>

          <button
            onClick={() => { setEmail("demo@artisancoffee.in"); setPassword("razorpay"); submit(); }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand/40 bg-brand-light px-4 py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-brand/10"
          >
            <Sparkles className="h-4 w-4" /> One-click demo sign-in
          </button>

          <p className="mt-6 text-center text-xs text-muted">
            Demo credentials are pre-filled · <span className="font-mono">demo@artisancoffee.in</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
