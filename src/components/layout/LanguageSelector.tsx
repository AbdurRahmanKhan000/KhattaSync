"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { LANGUAGES } from "@/lib/i18n/languages";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * The language list — a button in the top bar that opens the full list:
 * English, Urdu, Pashto, Punjabi, Sindhi, Arabic, Hindi. Picking one
 * switches the whole app immediately and remembers the choice in this
 * browser. Each language is shown in its own name and script.
 */
export function LanguageSelector() {
  const { lang, setLang, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language")}
        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:border-emerald-600"
      >
        <Globe className="h-4 w-4 text-emerald-700" />
        <span>{current.nativeName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
      </button>
      {open ? (
        <ul role="listbox" aria-label={t("language")} className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-lg">
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={l.code === lang}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-stone-50"
              >
                <span>
                  <span className="font-medium text-stone-800">{l.nativeName}</span>
                  <span className="ml-2 text-xs text-stone-500">{l.name}</span>
                </span>
                {l.code === lang ? <Check className="h-4 w-4 shrink-0 text-emerald-700" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
