import { useEffect, useState } from "react";
import { Sparkles, Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useRun } from "@/context/RunContext";
import { api } from "@/lib/api";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Your revenue operations at a glance" },
  "/collections": { title: "Collections", subtitle: "AI-scored receivables & smart reminders" },
  "/reconciliation": { title: "Reconciliation", subtitle: "Match settlements to your bank statement" },
  "/forecast": { title: "Cashflow Forecast", subtitle: "7-day outlook with early-warning alerts" },
  "/settings": { title: "Settings", subtitle: "Razorpay connection & agent configuration" },
};

export function Header({ path }: { path: string }) {
  const { running, runAll } = useRun();
  const [merchant, setMerchant] = useState("Artisan Coffee Co.");
  const [demo, setDemo] = useState(true);

  useEffect(() => {
    api.razorpayStatus().then((s) => {
      setMerchant(s.merchant_name);
      setDemo(s.demo_mode);
    }).catch(() => {});
  }, []);

  const meta = TITLES[path] ?? TITLES["/"];

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-8 py-5 backdrop-blur">
      <div>
        <h1 className="text-xl font-bold text-ink">{meta.title}</h1>
        <p className="text-sm text-muted">{meta.subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 md:flex">
          <Building2 className="h-4 w-4 text-muted" />
          <span className="text-sm font-medium text-ink">{merchant}</span>
          <span
            className={
              "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
              (demo ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")
            }
          >
            {demo ? "DEMO" : "LIVE"}
          </span>
        </div>

        <Button size="lg" onClick={runAll} disabled={running}>
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Agents working…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Run All Agents
            </>
          )}
        </Button>
      </div>
    </header>
  );
}
