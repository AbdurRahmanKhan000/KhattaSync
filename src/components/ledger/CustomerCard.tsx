import type { CustomerAccount } from "@/types";
import { formatPKR } from "@/lib/utils";
import { StatusBadge } from "@/components/layout";

export function CustomerCard({ customer }: { customer: CustomerAccount }) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{customer.name}</h3>
          <p className="text-xs text-stone-500">{customer.phone ?? "No phone saved"}</p>
        </div>
        <StatusBadge status={customer.balance === 0 ? "paid" : customer.isOverdue ? "due" : "credit"} />
      </div>
      <p className="mt-4 text-2xl font-bold tabular-nums">{formatPKR(Math.abs(customer.balance))}</p>
      <p className="text-xs text-stone-500">{customer.balance > 0 ? "To collect" : customer.balance < 0 ? "To pay" : "Settled"}</p>
    </article>
  );
}
