"use client";
import { useState } from "react";
import type { AiKeyMode, CustomerAccount } from "@/types";
import { buildReminderMessage, buildWhatsAppLink } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Check, Copy, MessageCircle, X } from "lucide-react";

/**
 * One-click WhatsApp reminder drawer: drafts a polite reminder with Gemini
 * (falls back to the local template when AI is unavailable), then opens
 * wa.me in one click, or copies the text to the clipboard.
 */
export function WhatsAppReminderModal({ customer, apiKey, hostKeyAllowed, model, apiMode, compact = false }: {
  customer: CustomerAccount; apiKey?: string; hostKeyAllowed?: boolean; model?: string; apiMode?: AiKeyMode; compact?: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function openDrawer() {
    setOpen(true); setCopied(false);
    if (draft) return;
    // No AI key at all: use the local template without a doomed request
    // (a failed fetch would only pollute the console).
    if (apiMode === "none") { setDraft(buildReminderMessage(customer)); return; }
    setDrafting(true);
    try {
      const res = await fetch("/api/parse-ledger", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reminder", input: `Remind ${customer.name} to pay ${Math.abs(customer.balance)} PKR on credit`,
          customerName: customer.name, balance: Math.abs(customer.balance), language: "en",
          apiKey, hostKeyAllowed: hostKeyAllowed !== false, model,
        }),
      });
      const data = (await res.json()) as { whatsapp_reminder_draft?: string };
      setDraft(data.whatsapp_reminder_draft ?? buildReminderMessage(customer));
    } catch {
      setDraft(buildReminderMessage(customer));
    } finally { setDrafting(false); }
  }

  const message = draft ?? buildReminderMessage(customer);

  return (
    <>
      <button type="button" onClick={() => void openDrawer()} className={compact ? "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-stone-50" : "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-stone-50"}>
        <MessageCircle className="h-4 w-4" /> {t("sendReminder")}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-label={`${t("reminderTitle")} — ${customer.name}`}>
          <button type="button" aria-label={t("close")} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <h2 className="font-semibold">{t("remind")} {customer.name}</h2>
              <button type="button" aria-label={t("close")} onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <p className="text-sm text-stone-600">{t("balanceLabel")}: <strong>{customer.balance > 0 ? t("toCollect") : t("settled")}</strong></p>
              {drafting ? (
                <div className="space-y-2" aria-label="Drafting reminder">
                  <div className="h-4 w-full animate-pulse rounded bg-stone-200" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-stone-200" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200" />
                  <p className="text-xs text-stone-500">{t("draftingReminder")}</p>
                </div>
              ) : (
                <p className="rounded-xl bg-stone-50 p-4 text-sm whitespace-pre-wrap">{message}</p>
              )}
              <p className="text-xs text-stone-500">{t("waHint")}</p>
            </div>
            <div className="flex gap-2 border-t border-stone-200 p-5">
              <a href={buildWhatsAppLink(customer.phone, message)} target="_blank" rel="noreferrer"
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700">
                {t("openWhatsApp")}
              </a>
              <button type="button" onClick={async () => { await navigator.clipboard.writeText(message); setCopied(true); }}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? t("copied") : t("copy")}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
