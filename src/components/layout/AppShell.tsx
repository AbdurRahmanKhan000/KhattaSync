"use client";
import type { ReactNode } from "react";
import { DashboardProvider } from "./DashboardContext";
import { Sidebar } from "./Sidebar";

/**
 * The app shell: sidebar + main column. The language provider sits
 * above this (LanguageShell in the root layout) so the cover page at /
 * shares the same language without the sidebar.
 */
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
