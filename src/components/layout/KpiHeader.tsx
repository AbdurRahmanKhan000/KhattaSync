import { formatPKR } from "@/lib/utils";
import type { AiKeyMode } from "@/types";
import { ApiModeBadge } from "./ApiModeBadge";

export function KpiHeader({ totalUdhaar, collectedToday, activeCustomers, apiMode, loading }: {
  totalUdhaar: number; collectedToday: number; activeCustomers: number; apiMode: AiKeyMode; loading: boolean;
}) {
  const cards = [
    { label: "Total Udhaar", sub: "Total outstanding credit", value: formatPKR(totalUdhaar) },
    { label: "Collected Today", sub: "Cash received today", value: formatPKR(collectedToday) },
    { label: "Active Customers", sub: "Customers with a balance", value: String(activeCustomers) },
  ];
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key totals">
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" aria-hidden>
            <div className="h-3 w-24 animate-pulse rounded bg-stone-200" />
            <div className="mt-3 h-8 w-32 animate-pulse rounded bg-stone-200" />
          </div>
        ))
      ) : (
        <>
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{c.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">{c.value}</p>
              <p className="mt-1 text-xs text-stone-500">{c.sub}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">API Mode</p>
            <div className="mt-3"><ApiModeBadge mode={apiMode} /></div>
            <p className="mt-2 text-xs text-stone-500">AI parsing key in use right now.</p>
          </div>
        </>
      )}
    </section>
  );
}
