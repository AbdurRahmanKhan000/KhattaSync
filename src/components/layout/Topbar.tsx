"use client";
import { Menu } from "lucide-react";
import { useDashboard } from "./DashboardContext";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { setSidebarOpen } = useDashboard();
  return (
    <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-4 sm:px-6">
      <button type="button" aria-label="Open customer ledgers" onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 hover:bg-stone-100 md:hidden">
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="truncate text-sm text-stone-500">{subtitle}</p> : null}
      </div>
    </header>
  );
}
