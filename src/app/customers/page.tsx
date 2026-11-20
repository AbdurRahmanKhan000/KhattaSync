"use client";
import { Topbar, useDashboard } from "@/components/layout";
import { CustomerCard } from "@/components/ledger";
import { DemoLoader } from "@/components/shared";

export default function CustomersPage() {
  const { customers, loading, userApiKey, adminConfig, apiMode } = useDashboard();
  return (
    <div>
      <Topbar title="Customers" subtitle="One running balance per person — the khata, organised by party." />
      {loading ? (
        <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading customers">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-stone-200" />)}
        </div>
      ) : customers.length === 0 ? (
        <div className="p-6"><p className="text-sm text-stone-500">No customers yet in this browser.</p><div className="mt-4"><DemoLoader /></div></div>
      ) : (
        <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
          {customers.map((c) => (
            <CustomerCard key={c.id} customer={c} apiKey={userApiKey} hostKeyAllowed={!(adminConfig?.hostKeyWithdrawn ?? false)} model={adminConfig?.model} apiMode={apiMode} />
          ))}
        </div>
      )}
    </div>
  );
}
