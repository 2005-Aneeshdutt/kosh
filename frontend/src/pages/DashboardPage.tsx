import { useEffect, useState } from "react";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { ARAgingChart } from "@/components/dashboard/ARAgingChart";
import { CashflowForecast } from "@/components/dashboard/CashflowForecast";
import { RecentPayments } from "@/components/dashboard/RecentPayments";
import { AgentActivityFeed } from "@/components/agents/AgentActivityFeed";
import { AgentCards } from "@/components/agents/AgentCards";
import { api, type ARAgingResponse, type DashboardMetrics, type ForecastResponse } from "@/lib/api";
import { useRun } from "@/context/RunContext";

export function DashboardPage() {
  const { runVersion } = useRun();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [aging, setAging] = useState<ARAgingResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);

  useEffect(() => {
    api.dashboardMetrics().then(setMetrics).catch(() => {});
    api.arAging().then(setAging).catch(() => {});
    api.forecast().then(setForecast).catch(() => {});
  }, [runVersion]);

  return (
    <div className="space-y-6">
      <AgentCards />

      {metrics && <MetricCards cards={metrics.cards} />}

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
