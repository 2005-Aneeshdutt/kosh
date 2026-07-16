import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { RunProvider } from "@/context/RunContext";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { CollectionsPage } from "@/pages/CollectionsPage";
import { ReconciliationPage } from "@/pages/ReconciliationPage";
import { ForecastPage } from "@/pages/ForecastPage";
import { SettingsPage } from "@/pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <RunProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/reconciliation" element={<ReconciliationPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </AppShell>
        <Toaster position="bottom-right" richColors />
      </RunProvider>
    </BrowserRouter>
  );
}
