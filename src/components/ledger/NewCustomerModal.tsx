"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function NewCustomerModal({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void; onCreate?: (name: string, phone?: string) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  if (!open) return null;
  return (
    <div role="dialog" aria-label={t("newCustomerTitle")} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("newCustomerTitle")}</h2>
          <button type="button" aria-label={t("close")} onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <form className="mt-4 space-y-3" onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onCreate?.(name.trim(), phone.trim() || undefined);
          setName(""); setPhone(""); onClose();
        }}>
          <label className="block text-sm">{t("nameLabel")}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bilal Khan" autoFocus
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-600" />
          </label>
          <label className="block text-sm">{t("phoneLabel")}
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3xx xxxxxxx" inputMode="tel"
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-600" />
          </label>
          <button type="submit" disabled={!name.trim()} className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{t("create")} {t("tableTitle")}</button>
        </form>
      </div>
    </div>
  );
}
