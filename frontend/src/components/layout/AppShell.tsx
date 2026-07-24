import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ChatWidget } from "@/components/chat/ChatWidget";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="relative flex min-h-screen bg-canvas">
      {/* Ambient aurora — soft, fixed, never in the way. */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-10 h-[36rem] w-[36rem] rounded-full bg-brand/10 blur-3xl animate-aurora-move" />
        <div className="absolute -right-40 top-40 h-[32rem] w-[32rem] rounded-full bg-violet/10 blur-3xl animate-aurora-move" style={{ animationDelay: "-6s" }} />
      </div>

      <Sidebar />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Header path={pathname} />
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
      <ChatWidget />
    </div>
  );
}
