import { useEffect, useState } from "react";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { ARAgingChart } from "@/components/dashboard/ARAgingChart";
import { CashflowForecast } from "@/components/dashboard/CashflowForecast";
import { RecentPayments } from "@/components/dashboard/RecentPayments";
import { AgentActivityFeed } from "@/components/agents/AgentActivityFeed";
import { AgentCards } from "@/components/agents/AgentCards";
import { api, type ARAgingResponse, type DashboardMetrics, type ForecastResponse } from "@/lib/api";
import { useRun } from "@/context/RunContext";
import { useLive } from "@/context/LiveContext";

export function DashboardPage() {
  const { runVersion } = useRun();
  const { pulse, lastMetrics } = useLive();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [aging, setAging] = useState<ARAgingResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [liveKey, setLiveKey] = useState<string | undefined>();

  useEffect(() => {
    api.dashboardMetrics().then(setMetrics).catch(() => {});
    api.arAging().then(setAging).catch(() => {});
    api.forecast().then(setForecast).catch(() => {});
  }, [runVersion, pulse]);

  // Flash the revenue / success cards when the live metrics tick.
  useEffect(() => {
    if (!lastMetrics) return;
    setLiveKey("revenue");
    const t = setTimeout(() => setLiveKey(undefined), 1200);
    return () => clearTimeout(t);
  }, [lastMetrics]);

  return (
    <div className="space-y-6">
      <AgentCards />
      {metrics && <MetricCards cards={metrics.cards} liveKey={liveKey} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {aging && <ARAgingChart data={aging} />}
        {forecast && <CashflowForecast data={forecast} />}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RecentPayments />
        <AgentActivityFeed />
      </div>
    </div>
  );
}
