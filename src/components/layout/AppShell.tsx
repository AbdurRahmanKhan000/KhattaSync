"use client";
import type { ReactNode } from "react";
import type { AppLanguage } from "@/lib/i18n/languages";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { DashboardProvider } from "./DashboardContext";
import { Sidebar } from "./Sidebar";

export function AppShell({ children, initialLang }: { children: ReactNode; initialLang?: AppLanguage }) {
  return (
    <LanguageProvider initialLang={initialLang}>
      <DashboardProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </DashboardProvider>
    </LanguageProvider>
  );
}
