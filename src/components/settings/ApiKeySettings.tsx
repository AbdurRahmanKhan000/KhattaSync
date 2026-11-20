"use client";
import { useEffect, useState } from "react";
import type { AiKeyMode } from "@/types";
import { getAdminConfig, getSettings, saveSettings } from "@/lib/db";
import { DEFAULT_MODEL, PROVIDER_LABELS, detectProvider, type AiProvider } from "@/lib/ai/providers";
import { notifyDataChanged, useDashboard } from "@/components/layout/DashboardContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function ApiKeyStatusBadge({ mode }: { mode: AiKeyMode }) {
  const { t } = useLanguage();
  const b =
    mode === "host" ? { label: t("badgeHost"), cls: "bg-emerald-100 text-emerald-800" }
    : mode === "personal" ? { label: t("badgePersonal"), cls: "bg-sky-100 text-sky-800" }
    : { label: t("badgeNone"), cls: "bg-red-100 text-red-800" };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.cls}`}>{b.label}</span>;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; provider: string; model: string; reply: string }
  | { status: "error"; error: string; detail?: string };

export function ApiKeySettings() {
  const { t } = useLanguage();
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [hostWithdrawn, setHostWithdrawn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  // The badge must agree with the dashboard and with the AI route: the
  // shared apiMode counts the host key ONLY when the server actually has
  // one configured (via /api/health). The old local computation said
  // "Host Hosted Key" whenever the Admin had not withdrawn it — even on
  // a deployment with no server key at all — while the agent correctly
  // reported "No AI key available". One source of truth now.
  const { apiMode } = useDashboard();

  useEffect(() => {
    void (async () => {
      const admin = await getAdminConfig();
      setHostWithdrawn(admin.hostKeyWithdrawn);
      setLoaded(true);
    })();
  }, []);

  // Provider detected from whatever is typed — the same bar takes a Gemini,
  // OpenAI, or Claude key. Nothing is detected from a half-typed key.
  const typedProvider: AiProvider | null = key.trim() ? detectProvider(key.trim()) : null;
  const detectedLabel = key.trim()
    ? typedProvider
      ? `${t("detectedLabel")} ${PROVIDER_LABELS[typedProvider]} — model ${DEFAULT_MODEL[typedProvider]}`
      : t("keyUnknown")
    : null;

  async function save() {
    const settings = await getSettings();
    await saveSettings({ ...settings, geminiApiKey: key.trim() || undefined });
    setSaved(true);
    setTest({ status: "idle" });
    // The dashboard badge + voice mode read settings through the shared
    // provider — tell it to reload now, not on the next page refresh.
    notifyDataChanged();
  }

  async function testConnection() {
    const k = key.trim();
    if (!k) return;
    setTest({ status: "testing" });
    try {
      const res = await fetch("/api/parse-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ping", apiKey: k, hostKeyAllowed: !hostWithdrawn }),
      });
      const data = (await res.json()) as { ok?: boolean; providerLabel?: string; model?: string; reply?: string; error?: string; detail?: string };
      if (data.ok) {
        setTest({ status: "ok", provider: data.providerLabel ?? "AI", model: data.model ?? "", reply: data.reply ?? "" });
      } else {
        setTest({ status: "error", error: data.error ?? t("keyTestFailed"), detail: data.detail });
      }
    } catch {
      setTest({ status: "error", error: t("keyUnreachable") });
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t("aiKeyTitle")}</h2>
        {loaded ? <ApiKeyStatusBadge mode={apiMode} /> : null}
      </div>
      <p className="mt-1 text-sm text-stone-500">
        {t("keyIntro")}
        {hostWithdrawn ? ` ${t("keyHostWithdrawnNote")}` : apiMode === "host" ? ` ${t("keyHostNote")}` : ` ${t("keyNoHostNote")}`}
      </p>
      {apiMode === "none" ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {hostWithdrawn ? t("keyWithdrawnAlert") : t("keyNoKeyAlert")}
        </p>
      ) : null}
      <label htmlFor="ai-key" className="sr-only">AI API key (Gemini, OpenAI, or Claude)</label>
      <input id="ai-key" type="password" value={key} onChange={(e) => { setKey(e.target.value); setSaved(false); setTest({ status: "idle" }); }} placeholder="AIza… / AQ.… / sk-… / sk-ant-…" autoComplete="off"
        className="mt-3 w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-600" />
      {detectedLabel ? (
        <p className={`mt-2 text-sm ${typedProvider ? "text-emerald-700" : "text-amber-700"}`}>{detectedLabel}</p>
      ) : null}
      {test.status === "testing" ? <p className="mt-2 text-sm text-stone-500">{t("testingKey")}</p> : null}
      {test.status === "ok" ? (
        <p role="status" className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {t("connectedLabel")} {test.provider} · {test.model} replied “{test.reply || "OK"}”. Entries will parse with this key.
        </p>
      ) : null}
      {test.status === "error" ? (
        <div role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{test.error}</p>
          {test.detail ? <p className="mt-1 text-xs text-red-600">Provider said: {test.detail}</p> : null}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void save()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
          {saved ? t("savedInBrowser") : t("saveKey")}
        </button>
        <button type="button" onClick={() => void testConnection()} disabled={!key.trim() || test.status === "testing"} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium disabled:opacity-50">
          {t("testKey")}
        </button>
        <button type="button" onClick={() => void (async () => { const s = await getSettings(); await saveSettings({ ...s, geminiApiKey: undefined }); setKey(""); setSaved(false); setTest({ status: "idle" }); notifyDataChanged(); })()} className="rounded-xl border px-4 py-2 text-sm font-medium">
          {t("removeKey")}
        </button>
      </div>
    </section>
  );
}
