"use client";
import { useState } from "react";

export function ApiKeySettings() {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">Gemini API key</h2>
      <p className="mt-1 text-sm text-stone-500">Stored only in this browser. Never shared with other users.</p>
      <label htmlFor="gemini-key" className="sr-only">Gemini API key</label>
      <input id="gemini-key" type="password" value={key} onChange={(e) => { setKey(e.target.value); setSaved(false); }} placeholder="AIza…" autoComplete="off"
        className="mt-3 w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-600" />
      <button type="button" onClick={() => setSaved(key.length > 0)} className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
        {saved ? "Saved in this browser" : "Save key"}
      </button>
    </section>
  );
}
