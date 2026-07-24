import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { LiveProvider } from "@/context/LiveContext";
import { RunProvider } from "@/context/RunContext";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CollectionsPage } from "@/pages/CollectionsPage";
import { ReconciliationPage } from "@/pages/ReconciliationPage";
import { ForecastPage } from "@/pages/ForecastPage";
import { AutopilotPage } from "@/pages/AutopilotPage";
import { StrategistPage } from "@/pages/StrategistPage";
import { ImpactPage } from "@/pages/ImpactPage";
import { AgentsPage } from "@/pages/AgentsPage";
import { StudioPage } from "@/pages/StudioPage";
import { LedgerPage } from "@/pages/LedgerPage";
import { AuditPage } from "@/pages/AuditPage";
import { MailPage } from "@/pages/MailPage";
import { SettingsPage } from "@/pages/SettingsPage";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="bottom-right" richColors theme={theme} />;
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

function Shell() {
  return (
    <LiveProvider>
      <RunProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/autopilot" element={<AutopilotPage />} />
            <Route path="/strategist" element={<StrategistPage />} />
            <Route path="/impact" element={<ImpactPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/studio" element={<StudioPage />} />
            <Route path="/reconciliation" element={<ReconciliationPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/ledger" element={<LedgerPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/mail" element={<MailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </RunProvider>
    </LiveProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pay/:invoiceId" element={<CheckoutPage />} />
          <Route path="/*" element={<Protected><Shell /></Protected>} />
        </Routes>
        <ThemedToaster />
      </AuthProvider>
    </BrowserRouter>
  );
}
