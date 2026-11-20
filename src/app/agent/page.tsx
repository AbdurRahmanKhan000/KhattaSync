"use client";
import { useMemo, useState } from "react";
import { formatPKR } from "@/lib/utils";
import { Topbar, useDashboard } from "@/components/layout";
import { AgentChat } from "@/components/ledger";
import { Toast } from "@/components/shared";
import { saveParsedEntry } from "@/lib/ledger-save";
import type { ParsedLedgerResult } from "@/types";

/**
 * AI Agent page — a real conversation with the khata. The shopkeeper
 * types or speaks; Gemini answers from the live ledger snapshot, asks one
 * short question when something is missing, and saves the entry the
 * moment it is complete (through the same save code as Quick Record).
 */
export default function AgentPage() {
  const { customers, transactions, loading, apiMode, apiProvider, userApiKey, adminConfig, today, reload } = useDashboard();
  const [toast, setToast] = useState<string | null>(null);

  const totalUdhaar = useMemo(() => customers.reduce((s, c) => s + Math.max(0, c.balance), 0), [customers]);
  const collectedToday = useMemo(
    () => (today ? transactions.filter((t) => t.type === "got" && t.date === today).reduce((s, t) => s + t.amount, 0) : 0),
    [transactions, today],
  );

  async function handleParsed(result: ParsedLedgerResult, rawInput: string, source: "text" | "voice") {
    const saved = await saveParsedEntry(result, rawInput, source, { customers });
    if (!saved) return;
    await reload();
    setToast(`Saved: ${saved.customerName} — ${formatPKR(saved.amount)}`);
    window.setTimeout(() => setToast(null), 4000);
  }

  return (
    <div>
      <Topbar title="AI Agent" subtitle="Ask anything about your khata — or just say what happened. Gemini answers, asks, and saves." />
      <div className="space-y-6 p-4 sm:p-6">
        {loading ? (
          <div className="space-y-2" aria-label="Loading khata">
            <div className="h-40 animate-pulse rounded-2xl bg-stone-200" />
            <div className="h-12 animate-pulse rounded-2xl bg-stone-200" />
          </div>
        ) : (
          <AgentChat
            onParsed={(r, raw, src) => void handleParsed(r, raw, src)}
            apiKey={userApiKey}
            hostKeyAllowed={!(adminConfig?.hostKeyWithdrawn ?? false)}
            model={adminConfig?.model}
            thinkingBudget={adminConfig?.thinkingBudget}
            audioEnabled={adminConfig?.audioTranscriptionEnabled ?? true}
            apiMode={apiMode}
            apiProvider={apiProvider}
            customers={customers}
            totalUdhaar={totalUdhaar}
            collectedToday={collectedToday}
          />
        )}
        {toast ? <Toast message={toast} /> : null}
      </div>
    </div>
  );
}
