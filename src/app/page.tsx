"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * The cover page. Nothing else lives here on purpose: the logo, the
 * name, one sentence in plain words, and the button into the app.
 * It sits outside the app shell — no sidebar, no top bar.
 */
export default function CoverPage() {
  const { t } = useLanguage();
  return (
    <div className="relative flex min-h-screen flex-col bg-[#f8f7f4]">
      <header className="flex justify-end p-4 sm:p-6">
        <LanguageSelector />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <div className="rounded-[2rem] shadow-xl shadow-emerald-900/20 ring-1 ring-emerald-900/10">
          <Image src="/logo-mark.svg" alt="KhattaSync logo" width={160} height={160} priority className="h-36 w-36 rounded-[2rem] sm:h-40 sm:w-40" />
        </div>

        <h1 className="mt-8 text-5xl font-bold tracking-tight text-stone-900 sm:text-6xl">KhattaSync</h1>

        <p className="mt-4 max-w-md text-lg leading-relaxed text-stone-600">{t("coverTagline")}</p>

        <Link href="/app" className="mt-10 inline-flex items-center gap-2 rounded-full bg-emerald-700 px-8 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
          {t("openApp")} <ArrowRight className="h-5 w-5" />
        </Link>
      </main>
    </div>
  );
}
