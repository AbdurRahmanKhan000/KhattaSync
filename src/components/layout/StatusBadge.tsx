"use client";
import type { EntryStatus } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const STYLES: Record<EntryStatus, string> = {
  credit: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  due: "bg-red-100 text-red-800",
  partial: "bg-sky-100 text-sky-800",
};

export function StatusBadge({ status }: { status: EntryStatus }) {
  const { t } = useLanguage();
  const label = status === "credit" ? t("credit") : status === "paid" ? t("paid") : status === "due" ? t("due") : t("partial");
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STYLES[status]}`}>{label}</span>;
}
