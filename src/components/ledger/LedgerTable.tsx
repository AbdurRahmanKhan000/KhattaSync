"use client";
import { useMemo, useState } from "react";
import type { AiKeyMode, EntryStatus, LedgerEntry } from "@/types";
import { formatPKR } from "@/lib/utils";
import { StatusBadge } from "@/components/layout";
import { WhatsAppReminderModal } from "./WhatsAppReminderModal";

function timeOf(e: LedgerEntry): string {
  try { return new Date(e.createdAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export function LedgerTable({ entries, onMarkPaid, loading = false, apiKey, hostKeyAllowed, model, apiMode }: {
  entries: LedgerEntry[];
  onMarkPaid?: (entry: LedgerEntry) => void;
  loading?: boolean;
  apiKey?: string; hostKeyAllowed?: boolean; model?: string; apiMode?: AiKeyMode;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | EntryStatus>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (status !== "all" && e.status !== status) return false;
      if (!q) return true;
      return e.customerName.toLowerCase().includes(q) || (e.note ?? "").toLowerCase().includes(q) || e.items?.some((i) => i.name.toLowerCase().includes(q));
    });
  }, [entries, query, status]);

  if (loading) {
    return (
      <div className="space-y-2 p-4" aria-label="Loading ledger">
        {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-stone-100" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-3">
        <label className="sr-only" htmlFor="ledger-search">Filter entries</label>
        <input id="ledger-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by customer, item or note…"
          className="min-w-40 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-600" />
        <label className="sr-only" htmlFor="ledger-status">Filter by status</label>
        <select id="ledger-status" value={status} onChange={(e) => setStatus(e.target.value as "all" | EntryStatus)} className="rounded-lg border border-stone-300 px-2 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="credit">Credit</option>
          <option value="paid">Paid</option>
          <option value="due">Due</option>
          <option value="partial">Partial</option>
        </select>
        <span className="text-xs text-stone-500">{filtered.length} of {entries.length} entries</span>
      </div>
      {filtered.length === 0 ? (
        <p className="p-6 text-sm text-stone-500">No entries match. Add your first entry above, or load the sample shop.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">Date · Time</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Items</th>
                <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Credit</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const paid = e.type === "got" ? e.amount : 0;
                const credit = e.type === "gave" ? e.amount : 0;
                const customer = { id: e.customerId, name: e.customerName, balance: credit, totalGave: credit, totalGot: paid, lastActivity: e.date, isOverdue: e.status === "due" };
                return (
                  <tr key={e.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-stone-600">{e.date}<br /><span className="text-xs text-stone-400">{timeOf(e)}</span></td>
                    <td className="px-4 py-3 font-medium">{e.customerName}</td>
                    <td className="px-4 py-3 text-stone-600">
                      {e.items && e.items.length > 0
                        ? e.items.map((i) => `${i.name} — ${formatPKR(i.amount)}`).join(", ")
                        : (e.note ?? "—")}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPKR(e.amount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{paid ? formatPKR(paid) : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">{credit ? formatPKR(credit) : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {(e.status === "credit" || e.status === "due" || e.status === "partial") && onMarkPaid ? (
                          <button type="button" onClick={() => onMarkPaid(e)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">Mark Paid</button>
                        ) : null}
                        {credit > 0 && e.status !== "paid" ? <WhatsAppReminderModal customer={customer} apiKey={apiKey} hostKeyAllowed={hostKeyAllowed} model={model} apiMode={apiMode} compact /> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
