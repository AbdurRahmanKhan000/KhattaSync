import type { LedgerEntry } from "@/types";
import { formatPKR } from "@/lib/utils";
import { StatusBadge } from "@/components/layout";

export function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return <p className="p-6 text-sm text-stone-500">No entries yet. Add your first entry above.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
            <th className="px-4 py-3">Date</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Note</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-stone-100 last:border-0">
              <td className="px-4 py-3 tabular-nums text-stone-600">{e.date}</td>
              <td className="px-4 py-3 font-medium">{e.customerName}</td>
              <td className="px-4 py-3 capitalize">{e.type === "gave" ? "You gave" : "You got"}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPKR(e.amount)}</td>
              <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
              <td className="px-4 py-3 text-stone-600">{e.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
