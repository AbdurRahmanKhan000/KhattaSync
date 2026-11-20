import { formatPKR } from "@/lib/utils";
import type { AiKeyMode } from "@/types";
import { PROVIDER_LABELS, type AiProvider } from "@/lib/ai/providers";
import { ApiModeBadge } from "./ApiModeBadge";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function KpiHeader({ totalUdhaar, collectedToday, activeCustomers, apiMode, apiProvider, loading }: {
  totalUdhaar: number; collectedToday: number; activeCustomers: number; apiMode: AiKeyMode; apiProvider?: AiProvider; loading: boolean;
}) {
  const { t } = useLanguage();
  const cards = [
    { label: t("totalCredit"), sub: t("totalOutstandingCredit"), value: formatPKR(totalUdhaar) },
    { label: t("collectedToday"), sub: t("cashReceivedToday"), value: formatPKR(collectedToday) },
    { label: t("activeCustomers"), sub: t("customersWithBalance"), value: String(activeCustomers) },
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
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t("apiMode")}</p>
            <div className="mt-3"><ApiModeBadge mode={apiMode} provider={apiProvider} /></div>
            <p className="mt-2 text-xs text-stone-500">
              {apiMode === "none"
                ? t("noAiKeyAdd")
                : apiMode === "personal"
                  ? `${t("yourKeyInUse")}${apiProvider ? ` · ${PROVIDER_LABELS[apiProvider]}` : ""}.`
                  : `${t("hostKeyInUse")}${apiProvider ? ` · ${PROVIDER_LABELS[apiProvider]}` : ""}.`}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
