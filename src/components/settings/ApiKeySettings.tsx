"use client";
import { useEffect, useState } from "react";
import type { AiKeyMode } from "@/types";
import { getAdminConfig, getSettings, saveSettings } from "@/lib/db";
import { DEFAULT_MODEL, PROVIDER_LABELS, detectProvider, type AiProvider } from "@/lib/ai/providers";
import { notifyDataChanged } from "@/components/layout/DashboardContext";

const BADGE: Record<AiKeyMode, { label: string; cls: string }> = {
  host: { label: "Host Hosted Key", cls: "bg-emerald-100 text-emerald-800" },
  personal: { label: "Personal User API Key", cls: "bg-sky-100 text-sky-800" },
  none: { label: "No AI Key — AI parsing off", cls: "bg-red-100 text-red-800" },
};

export function ApiKeyStatusBadge({ mode }: { mode: AiKeyMode }) {
  const b = BADGE[mode];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.cls}`}>{b.label}</span>;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; provider: string; model: string; reply: string }
  | { status: "error"; error: string; detail?: string };

export function ApiKeySettings() {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<AiKeyMode>("host");
  const [hostWithdrawn, setHostWithdrawn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });

  useEffect(() => {
    void (async () => {
      const [settings, admin] = await Promise.all([getSettings(), getAdminConfig()]);
      setHostWithdrawn(admin.hostKeyWithdrawn);
      setMode(settings.geminiApiKey ? "personal" : admin.hostKeyWithdrawn ? "none" : "host");
      setLoaded(true);
    })();
  }, []);

  // Provider detected from whatever is typed — the same bar takes a Gemini,
  // OpenAI, or Claude key. Nothing is detected from a half-typed key.
  const typedProvider: AiProvider | null = key.trim() ? detectProvider(key.trim()) : null;
  const detectedLabel = key.trim()
    ? typedProvider
      ? `Detected: ${PROVIDER_LABELS[typedProvider]} — model ${DEFAULT_MODEL[typedProvider]}`
      : "Unknown key — Gemini keys start with AIza or AQ., OpenAI with sk-, Claude with sk-ant-"
    : null;

  async function save() {
    const settings = await getSettings();
    await saveSettings({ ...settings, geminiApiKey: key.trim() || undefined });
    setMode(key.trim() ? "personal" : hostWithdrawn ? "none" : "host");
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
        setTest({ status: "error", error: data.error ?? "Test failed.", detail: data.detail });
      }
    } catch {
      setTest({ status: "error", error: "Could not reach the app server — check your connection and try again." });
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">AI API key — Gemini, OpenAI, or Claude (BYOK)</h2>
        {loaded ? <ApiKeyStatusBadge mode={mode} /> : null}
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Paste any one key in this same bar — Gemini (AIza… or AQ.…), OpenAI (sk-…), or Claude (sk-ant-…). Your key is stored only in this browser (IndexedDB) and sent per-request to the AI route — never stored on a server.
        {hostWithdrawn ? " The Admin has withdrawn the host key, so AI parsing needs your own key." : " If you enter your own key it takes over from the host key."}
      </p>
      {mode === "none" ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          Host key withdrawn — enter your AI key below to use AI parsing.
        </p>
      ) : null}
      <label htmlFor="ai-key" className="sr-only">AI API key (Gemini, OpenAI, or Claude)</label>
      <input id="ai-key" type="password" value={key} onChange={(e) => { setKey(e.target.value); setSaved(false); setTest({ status: "idle" }); }} placeholder="AIza… / AQ.… / sk-… / sk-ant-…" autoComplete="off"
        className="mt-3 w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-600" />
      {detectedLabel ? (
        <p className={`mt-2 text-sm ${typedProvider ? "text-emerald-700" : "text-amber-700"}`}>{detectedLabel}</p>
      ) : null}
      {test.status === "testing" ? <p className="mt-2 text-sm text-stone-500">Testing the key…</p> : null}
      {test.status === "ok" ? (
        <p role="status" className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Connected — {test.provider} · {test.model} replied “{test.reply || "OK"}”. Entries will parse with this key.
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
          {saved ? "Saved in this browser" : "Save key"}
        </button>
        <button type="button" onClick={() => void testConnection()} disabled={!key.trim() || test.status === "testing"} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium disabled:opacity-50">
          Test this key
        </button>
        <button type="button" onClick={() => void (async () => { const s = await getSettings(); await saveSettings({ ...s, geminiApiKey: undefined }); setKey(""); setSaved(false); setTest({ status: "idle" }); setMode(hostWithdrawn ? "none" : "host"); notifyDataChanged(); })()} className="rounded-xl border px-4 py-2 text-sm font-medium">
          Remove my key
        </button>
      </div>
    </section>
  );
}
