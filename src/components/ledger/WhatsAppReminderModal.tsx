"use client";
import { useState } from "react";
import type { CustomerAccount } from "@/types";
import { buildReminderMessage, buildWhatsAppLink } from "@/lib/utils";
import { MessageCircle, X } from "lucide-react";

export function WhatsAppReminderModal({ customer }: { customer: CustomerAccount }) {
  const [open, setOpen] = useState(false);
  const message = buildReminderMessage(customer);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"><MessageCircle className="h-4 w-4" /> Remind</button>;
  }
  return (
    <div role="dialog" aria-label="WhatsApp reminder" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Remind {customer.name}</h2><button type="button" aria-label="Close" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div>
        <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm whitespace-pre-wrap">{message}</p>
        <a href={buildWhatsAppLink(customer.phone, message)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Open WhatsApp</a>
      </div>
    </div>
  );
}
