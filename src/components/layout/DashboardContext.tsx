"use client";
/* eslint-disable react-hooks/set-state-in-effect -- IndexedDB is browser-only:
   the ledger must load after mount (server render stays empty/skeleton, so
   there is no hydration mismatch). Loading in render would crash SSR. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AdminConfig, AiKeyMode, AppSettings, CustomerAccount, LedgerEntry } from "@/types";
import { getAdminConfig, getSettings, listCustomers, listTransactions } from "@/lib/db";
import { detectProvider, type AiProvider } from "@/lib/ai/providers";

export interface DashboardState {
  customers: CustomerAccount[];
  transactions: LedgerEntry[];
  loading: boolean;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  apiMode: AiKeyMode;
  /** Which provider's key is in use: "gemini" for the host key, or detected from the user's own key. */
  apiProvider: AiProvider;
  userApiKey?: string;
  adminConfig: AdminConfig | null;
  settings: AppSettings | null;
  today: string;
  reload: () => Promise<void>;
}

const DashboardContext = createContext<DashboardState | null>(null);

export function useDashboard(): DashboardState {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside <DashboardProvider>.");
  return ctx;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
  const [hostKeyConfigured, setHostKeyConfigured] = useState<boolean | null>(null);
  const [today, setToday] = useState("");

  const reload = useCallback(async () => {
    const [c, t, s, a] = await Promise.all([listCustomers(), listTransactions(), getSettings(), getAdminConfig()]);
    try {
      const h = (await (await fetch("/api/health")).json()) as { aiKeyConfigured?: boolean };
      setHostKeyConfigured(Boolean(h.aiKeyConfigured));
    } catch { setHostKeyConfigured(false); }
    setCustomers(c);
    setTransactions(t);
    setSettings(s);
    setAdminConfig(a);
    // Set here, not in the effect: today's date is client-only, so the
    // server render and first client render stay identical (no hydration mismatch).
    setToday(new Date().toISOString().slice(0, 10));
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const onChange = () => void reload();
    window.addEventListener("khattasync:data-changed", onChange);
    return () => window.removeEventListener("khattasync:data-changed", onChange);
  }, [reload]);

  // The host key only counts when the server actually has one configured;
  // otherwise the badge (and the fetch guards) must say "none", not "host".
  const apiMode: AiKeyMode = settings?.geminiApiKey
    ? "personal"
    : adminConfig?.hostKeyWithdrawn || hostKeyConfigured === false
      ? "none"
      : "host";
  const apiProvider: AiProvider = settings?.geminiApiKey
    ? detectProvider(settings.geminiApiKey) ?? "gemini"
    : "gemini";

  const value = useMemo<DashboardState>(() => ({
    customers, transactions, loading, selectedCustomerId, setSelectedCustomerId,
    sidebarOpen, setSidebarOpen, apiMode, apiProvider, userApiKey: settings?.geminiApiKey,
    adminConfig, settings, today, reload,
  }), [customers, transactions, loading, selectedCustomerId, sidebarOpen, apiMode, apiProvider, settings, adminConfig, today, reload]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

/** Notify every DashboardProvider listener that local data changed (optimistic UI refresh). */
export function notifyDataChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("khattasync:data-changed"));
}
