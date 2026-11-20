"use client";
import { useMemo, useState } from "react";
import { formatPKR } from "@/lib/utils";
import { KpiHeader, Topbar, useDashboard } from "@/components/layout";
import { LedgerTable, TransactionEntryBar } from "@/components/ledger";
import { DemoLoader, Toast } from "@/components/shared";
import { addEntry, addTransaction, createCustomer, listCustomers, logEntry, updateTransaction } from "@/lib/db";
import type { LedgerEntry, ParsedLedgerResult } from "@/types";

export default function DashboardPage() {
  const { customers, transactions, loading, selectedCustomerId, apiMode, userApiKey, adminConfig, today, reload } = useDashboard();
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
    const name = result.customer_name.trim();
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const stamp = now.toISOString();
    // Find or create the customer, then post the entry — optimistic: the
    // table updates from local IndexedDB the moment reload() lands.
    let customer = customers.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!customer) {
      const id = `cust-${crypto.randomUUID()}`;
      await createCustomer({ id, name, balance: 0, totalGave: 0, totalGot: 0, lastActivity: date, isOverdue: false });
      const fresh = await listCustomers();
      customer = fresh.find((c) => c.id === id);
      if (!customer) return;
    }
    const isPayment = result.action_type === "payment";
    const entry: LedgerEntry = {
      id: `txn-${crypto.randomUUID()}`,
      customerId: customer.id,
      customerName: customer.name,
      type: isPayment ? "got" : "gave",
      amount: result.total_amount,
      status: result.credit_balance_change > 0 ? (customer.isOverdue ? "due" : "credit") : "paid",
      note: result.items.map((i) => `${i.name} — ${formatPKR(i.amount)}`).join(", ") || undefined,
      items: result.items,
      date,
      createdAt: stamp,
      updatedAt: stamp,
      source,
      rawInput,
    };
    await addTransaction(entry);
    await logEntry({
      id: `log-${crypto.randomUUID()}`, rawInput, source,
      status: "parsed", customerName: customer.name, amount: result.total_amount,
      transactionId: entry.id, createdAt: stamp,
    });
    await reload();
    setToast(`Saved: ${customer.name} — ${formatPKR(result.total_amount)}`);
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
      <Topbar title={selectedCustomer ? `${selectedCustomer.name} — Khata` : "Dashboard"} subtitle={selectedCustomer ? `Balance ${formatPKR(Math.abs(selectedCustomer.balance))} · ${selectedCustomer.balance > 0 ? "to collect" : selectedCustomer.balance < 0 ? "to pay" : "settled"}` : "Your digital khata — who owes what, at a glance."} />
      <div className="space-y-6 p-4 sm:p-6">
        <KpiHeader totalUdhaar={totalUdhaar} collectedToday={collectedToday} activeCustomers={activeCustomers} apiMode={apiMode} loading={loading} />

        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Quick record">
          <h2 className="text-sm font-semibold">Quick Record</h2>
          <p className="mt-0.5 text-xs text-stone-500">Type or speak an entry — Gemini parses it into a structured ledger line.</p>
          <div className="mt-3">
            <TransactionEntryBar
              onParsed={(r, raw, src) => void handleParsed(r, raw, src)}
              apiKey={userApiKey}
              hostKeyAllowed={!(adminConfig?.hostKeyWithdrawn ?? false)}
              model={adminConfig?.model}
              thinkingBudget={adminConfig?.thinkingBudget}
              audioEnabled={adminConfig?.audioTranscriptionEnabled ?? true}
              apiMode={apiMode}
            />
          </div>
        </section>

        {toast ? <Toast message={toast} /> : null}

        {customers.length === 0 && !loading ? (
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Your khata is empty</h2>
            <p className="mt-1 text-sm text-stone-500">Add a customer from the sidebar, record your first entry above, or load the Peshawar sample shop to explore.</p>
            <div className="mt-4"><DemoLoader /></div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-stone-200 bg-white shadow-sm" aria-label="Ledger">
          <h2 className="border-b border-stone-200 px-4 py-4 font-semibold">
            {selectedCustomer ? `Entries — ${selectedCustomer.name}` : "Recent entries"}
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
