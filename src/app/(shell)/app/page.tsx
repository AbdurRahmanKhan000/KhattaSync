"use client";
import { useMemo, useState } from "react";
import { formatPKR } from "@/lib/utils";
import { KpiHeader, Topbar, useDashboard } from "@/components/layout";
import { LedgerTable, TransactionEntryBar } from "@/components/ledger";
import { DemoLoader, Toast } from "@/components/shared";
import { addEntry, updateTransaction } from "@/lib/db";
import { saveParsedEntry } from "@/lib/ledger-save";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { LedgerEntry, ParsedLedgerResult } from "@/types";

export default function DashboardPage() {
  const { customers, transactions, loading, selectedCustomerId, apiMode, apiProvider, userApiKey, adminConfig, today, reload } = useDashboard();
  const { t } = useLanguage();
  const [toast, setToast] = useState<string | null>(null);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );

  const visibleTransactions = useMemo(
    () => (selectedCustomerId ? transactions.filter((t) => t.customerId === selectedCustomerId) : transactions),
    [transactions, selectedCustomerId],
  );

  const totalUdhaar = useMemo(() => customers.reduce((s, c) => s + Math.max(0, c.balance), 0), [customers]);
  const collectedToday = useMemo(
    () => (today ? transactions.filter((t) => t.type === "got" && t.date === today).reduce((s, t) => s + t.amount, 0) : 0),
    [transactions, today],
  );
  const activeCustomers = useMemo(() => customers.filter((c) => c.balance !== 0).length, [customers]);

  async function handleParsed(result: ParsedLedgerResult, rawInput: string, source: "text" | "voice") {
    // One shared save path (see src/lib/ledger-save.ts) — the AI Agent
    // page saves through the exact same code.
    const saved = await saveParsedEntry(result, rawInput, source, { customers });
    if (!saved) return;
    await reload();
    setToast(`Saved: ${saved.customerName} — ${formatPKR(saved.amount)}`);
    window.setTimeout(() => setToast(null), 4000);
  }

  async function handleMarkPaid(entry: LedgerEntry) {
    const now = new Date();
    const stamp = now.toISOString();
    // Quick-settle: post the matching payment, then mark the original paid.
    const payment: LedgerEntry = {
      id: `txn-${crypto.randomUUID()}`,
      customerId: entry.customerId, customerName: entry.customerName,
      type: "got", amount: entry.amount, status: "paid",
      note: `Payment received — settles ${entry.date} entry`,
      date: stamp.slice(0, 10), createdAt: stamp, updatedAt: stamp, source: "manual",
    };
    await addEntry(payment);
    await updateTransaction({ ...entry, status: "paid" });
    await reload();
    setToast(`${entry.customerName} marked paid — ${formatPKR(entry.amount)} received.`);
    window.setTimeout(() => setToast(null), 4000);
  }

  return (
    <div>
      <Topbar title={selectedCustomer ? `${selectedCustomer.name} — ${t("tableTitle")}` : t("navDashboard")} subtitle={selectedCustomer ? `${t("balanceLabel")} ${formatPKR(Math.abs(selectedCustomer.balance))} · ${selectedCustomer.balance > 0 ? t("toCollect") : selectedCustomer.balance < 0 ? t("toPay") : t("settled")}` : t("dashboardSubtitle")} />
      <div className="space-y-6 p-4 sm:p-6">
        <KpiHeader totalUdhaar={totalUdhaar} collectedToday={collectedToday} activeCustomers={activeCustomers} apiMode={apiMode} apiProvider={apiProvider} loading={loading} />

        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Quick record">
          <h2 className="text-sm font-semibold">{t("quickRecord")}</h2>
          <p className="mt-0.5 text-xs text-stone-500">{t("quickRecordHint")}</p>
          <div className="mt-3">
            <TransactionEntryBar
              onParsed={(r, raw, src) => void handleParsed(r, raw, src)}
              apiKey={userApiKey}
              hostKeyAllowed={!(adminConfig?.hostKeyWithdrawn ?? false)}
              model={adminConfig?.model}
              thinkingBudget={adminConfig?.thinkingBudget}
              audioEnabled={adminConfig?.audioTranscriptionEnabled ?? true}
              apiMode={apiMode}
              customers={customers}
              transactions={transactions}
              totalUdhaar={totalUdhaar}
              collectedToday={collectedToday}
            />
          </div>
        </section>

        {toast ? <Toast message={toast} /> : null}

        {customers.length === 0 && !loading ? (
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold">{t("emptyLedgerTitle")}</h2>
            <p className="mt-1 text-sm text-stone-500">{t("emptyLedgerHint")}</p>
            <div className="mt-4"><DemoLoader /></div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-stone-200 bg-white shadow-sm" aria-label="Ledger">
          <h2 className="border-b border-stone-200 px-4 py-4 font-semibold">
            {selectedCustomer ? `${t("entriesWord")} — ${selectedCustomer.name}` : t("recentEntries")}
          </h2>
          <LedgerTable
            entries={visibleTransactions}
            loading={loading}
            onMarkPaid={(e) => void handleMarkPaid(e)}
            apiKey={userApiKey}
            hostKeyAllowed={!(adminConfig?.hostKeyWithdrawn ?? false)}
            model={adminConfig?.model}
            apiMode={apiMode}
          />
        </section>
      </div>
    </div>
  );
}
