"use client";
import { useEffect, useState } from "react";
import type { AiKeyMode } from "@/types";
import { getAdminConfig, getSettings, saveSettings } from "@/lib/db";

const BADGE: Record<AiKeyMode, { label: string; cls: string }> = {
  host: { label: "Host Hosted Key", cls: "bg-emerald-100 text-emerald-800" },
  personal: { label: "Personal User API Key", cls: "bg-sky-100 text-sky-800" },
  none: { label: "No AI Key — AI parsing off", cls: "bg-red-100 text-red-800" },
};

export function ApiKeyStatusBadge({ mode }: { mode: AiKeyMode }) {
  const b = BADGE[mode];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.cls}`}>{b.label}</span>;
}

export function ApiKeySettings() {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<AiKeyMode>("host");
  const [hostWithdrawn, setHostWithdrawn] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const [settings, admin] = await Promise.all([getSettings(), getAdminConfig()]);
      setHostWithdrawn(admin.hostKeyWithdrawn);
      setMode(settings.geminiApiKey ? "personal" : admin.hostKeyWithdrawn ? "none" : "host");
      setLoaded(true);
    })();
  }, []);

  async function save() {
    const settings = await getSettings();
    await saveSettings({ ...settings, geminiApiKey: key.trim() || undefined });
    setMode(key.trim() ? "personal" : hostWithdrawn ? "none" : "host");
    setSaved(true);
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Gemini API key (BYOK)</h2>
        {loaded ? <ApiKeyStatusBadge mode={mode} /> : null}
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Your key is stored only in this browser (IndexedDB) and sent per-request to the AI route — never stored on a server.
        {hostWithdrawn ? " The Admin has withdrawn the host key, so AI parsing needs your own key." : " If you enter your own key it takes over from the host key."}
      </p>
      {mode === "none" ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          Host key withdrawn — enter your Gemini API key below to use AI parsing.
        </p>
      ) : null}
      <label htmlFor="gemini-key" className="sr-only">Gemini API key</label>
      <input id="gemini-key" type="password" value={key} onChange={(e) => { setKey(e.target.value); setSaved(false); }} placeholder="AIza…" autoComplete="off"
        className="mt-3 w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-600" />
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => void save()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
          {saved ? "Saved in this browser" : "Save key"}
        </button>
        <button type="button" onClick={() => void (async () => { const s = await getSettings(); await saveSettings({ ...s, geminiApiKey: undefined }); setKey(""); setSaved(false); setMode(hostWithdrawn ? "none" : "host"); })()} className="rounded-xl border px-4 py-2 text-sm font-medium">
          Remove my key
        </button>
      </div>
    </section>
  );
}
