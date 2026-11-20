"use client";
import { Topbar, useDashboard } from "@/components/layout";
import { CustomerCard } from "@/components/ledger";
import { DemoLoader } from "@/components/shared";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function CustomersPage() {
  const { customers, loading, userApiKey, adminConfig, apiMode } = useDashboard();
  const { t } = useLanguage();
  return (
    <div>
      <Topbar title={t("customersTitle")} subtitle={t("customersSubtitle")} />
      {loading ? (
        <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading customers">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-stone-200" />)}
        </div>
      ) : customers.length === 0 ? (
        <div className="p-6"><p className="text-sm text-stone-500">{t("noCustomersYet")}</p><div className="mt-4"><DemoLoader /></div></div>
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
