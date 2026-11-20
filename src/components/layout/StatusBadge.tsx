import type { EntryStatus } from "@/types";

const STYLES: Record<EntryStatus, string> = {
  credit: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  due: "bg-red-100 text-red-800",
  partial: "bg-sky-100 text-sky-800",
};

const LABELS: Record<EntryStatus, string> = {
  credit: "Credit", paid: "Paid", due: "Due", partial: "Partial",
};

export function StatusBadge({ status }: { status: EntryStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STYLES[status]}`}>{LABELS[status]}</span>;
}
