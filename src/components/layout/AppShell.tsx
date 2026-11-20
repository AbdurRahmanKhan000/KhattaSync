"use client";
import type { ReactNode } from "react";
import { DashboardProvider } from "./DashboardContext";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </DashboardProvider>
  );
}
