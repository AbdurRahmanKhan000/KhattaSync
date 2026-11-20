import { DEMO_CUSTOMERS, DEMO_ENTRIES } from "@/constants";
import { formatPKR } from "@/lib/utils";
import { Topbar } from "@/components/layout";
import { LedgerTable, TransactionEntryBar, VoiceRecorder } from "@/components/ledger";
import { DemoLoader } from "@/components/shared";

export default function DashboardPage() {
  const toCollect = DEMO_CUSTOMERS.reduce((s, c) => s + Math.max(0, c.balance), 0);
  const overdue = DEMO_CUSTOMERS.filter((c) => c.isOverdue).length;
  return (
    <div>
      <Topbar title="Dashboard" subtitle="Your digital khata — who owes what, at a glance." />
      <div className="space-y-6 p-6">
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Key totals">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">To collect</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{formatPKR(toCollect)}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Customers</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{DEMO_CUSTOMERS.length}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Overdue accounts</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-red-600">{overdue}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" aria-label="Add entry">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1"><TransactionEntryBar /></div>
            <VoiceRecorder />
            <DemoLoader />
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white shadow-sm" aria-label="Ledger">
          <h2 className="border-b border-stone-200 px-4 py-4 font-semibold">Recent entries</h2>
          <LedgerTable entries={DEMO_ENTRIES} />
        </section>
      </div>
    </div>
  );
}
