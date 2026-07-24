import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { CommandPalette } from "@/components/command/CommandPalette";
import { GuidedTour } from "@/components/onboarding/GuidedTour";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="relative flex min-h-screen bg-canvas">
      {/* Ambient aurora — soft, fixed, never in the way. */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-10 h-[36rem] w-[36rem] rounded-full bg-brand/10 blur-3xl animate-aurora-move" />
        <div className="absolute -right-40 top-40 h-[32rem] w-[32rem] rounded-full bg-violet/10 blur-3xl animate-aurora-move" style={{ animationDelay: "-6s" }} />
      </div>

      {/* Mobile drawer backdrop */}
      {mobileNav && (
        <div
          className="fixed inset-0 z-30 bg-navy-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNav(false)}
        />
      )}

      <Sidebar mobileOpen={mobileNav} onClose={() => setMobileNav(false)} />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Header path={pathname} onMenu={() => setMobileNav(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <ChatWidget />
      <CommandPalette />
      <GuidedTour />
    </div>
  );
}
