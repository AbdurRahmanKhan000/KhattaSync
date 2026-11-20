"use client";
import { useState } from "react";
import type { DbSelfTestResult } from "@/types";
import { runDbSelfTest } from "@/lib/db";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function DbSelfTest() {
  const { t } = useLanguage();
  const [results, setResults] = useState<DbSelfTestResult[] | null>(null);
  const [running, setRunning] = useState(false);
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">{t("selfTest")}</h2>
      <p className="mt-1 text-sm text-stone-500">
        {t("selfTestHint")}
      </p>
      <button
        type="button"
        disabled={running}
        onClick={async () => { setRunning(true); setResults(await runDbSelfTest()); setRunning(false); }}
        className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {running ? t("selfTestRunning") : t("selfTestRun")}
      </button>
      {results ? (
        <ul className="mt-4 space-y-2 text-sm">
          {results.map((r) => (
            <li key={r.name} className="flex gap-2">
              <span aria-hidden>{r.passed ? "✅" : "❌"}</span>
              <span><strong>{r.name}:</strong> {r.passed ? "PASS" : "FAIL"} — {r.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
