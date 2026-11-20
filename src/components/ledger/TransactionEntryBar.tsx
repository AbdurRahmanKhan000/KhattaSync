"use client";
import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { AiKeyMode, CustomerAccount, ParsedLedgerResult } from "@/types";
import { answerLedgerQuery } from "@/lib/ledger-query";
import { VoiceRecorder } from "./VoiceRecorder";

export function TransactionEntryBar({ onParsed, apiKey, hostKeyAllowed, model, thinkingBudget, audioEnabled = true, apiMode, customers = [], totalUdhaar = 0, collectedToday = 0 }: {
  onParsed?: (result: ParsedLedgerResult, rawInput: string, source: "text" | "voice") => void;
  apiKey?: string; hostKeyAllowed?: boolean; model?: string; thinkingBudget?: string; audioEnabled?: boolean; apiMode?: AiKeyMode;
  customers?: CustomerAccount[]; totalUdhaar?: number; collectedToday?: number;
}) {
  const [text, setText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [lang, setLang] = useState<"en-PK" | "ur-PK" | "ps-AF">("en-PK");
  const [voiceNote, setVoiceNote] = useState(false);

  /** Gemini voice-note path: audio -> Gemini transcribes + parses it. */
  async function submitVoiceNote(blob: Blob) {
    if (processing) return;
    if (apiMode === "none") {
      setError("No AI key available — add your Gemini key in Settings, or ask the Admin to restore the host key.");
      return;
    }
    setProcessing(true); setVoiceNote(true); setError(null); setSuccess(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Could not read the voice note."));
        reader.readAsDataURL(blob);
      });
      const res = await fetch("/api/parse-ledger", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "voice", audio: base64, mimeType: blob.type || "audio/webm", apiKey, hostKeyAllowed: hostKeyAllowed !== false, model, thinkingBudget }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; parsed?: ParsedLedgerResult };
      if (!res.ok || !data.parsed?.is_valid_ledger_entry) {
        setError(data.error ?? "Could not understand that voice note — try again, or type the entry.");
        return;
      }
      setSuccess(`${data.parsed.customer_name} · ${data.parsed.total_amount} PKR · ${data.parsed.action_type}`);
      setAnswer(null);
      onParsed?.(data.parsed, "(voice note)", "voice");
    } catch {
      setError("Voice note failed — check your connection or API key in Settings.");
    } finally { setProcessing(false); setVoiceNote(false); }
  }

  async function submit(raw: string, source: "text" | "voice") {
    const input = raw.trim();
    if (!input || processing) return;
    // 1) Balance questions are answered instantly from the local ledger.
    const localAnswer = answerLedgerQuery(input, { customers, totalUdhaar, collectedToday });
    if (localAnswer) {
      setAnswer(localAnswer); setError(null); setSuccess(null); setText("");
      return;
    }
    // 2) No amount and no question: ask for the amount instead of
    //    rejecting a hurried shopkeeper with the ledger-only message.
    if (!/\d/.test(input)) {
      setError("Add the amount — e.g. \"Bilal took flour 3200, paid 2000\". Who, what, and how much?");
      return;
    }
    if (apiMode === "none") {
      setError("No AI key available — add your Gemini key in Settings, or ask the Admin to restore the host key.");
      return;
    }
    setProcessing(true); setError(null); setSuccess(null);
    try {
      const res = await fetch("/api/parse-ledger", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, apiKey, hostKeyAllowed: hostKeyAllowed !== false, model, thinkingBudget }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; parsed?: ParsedLedgerResult };
      if (!res.ok || !data.parsed?.is_valid_ledger_entry) {
        setError(data.error ?? "Could not parse that entry. Try: name, amount, gave or got.");
        return;
      }
      setSuccess(`${data.parsed.customer_name} · ${data.parsed.total_amount} PKR · ${data.parsed.action_type}`);
      setAnswer(null);
      onParsed?.(data.parsed, input, source);
      setText("");
    } catch {
      setError("AI parsing failed — check your connection or API key in Settings.");
    } finally { setProcessing(false); }
  }

  return (
    <div className="space-y-2">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void submit(text, "text"); }}>
        <label htmlFor="ledger-entry" className="sr-only">Quick-record a ledger entry</label>
        <input id="ledger-entry" value={text} onChange={(e) => { setText(e.target.value); setAnswer(null); }} disabled={processing}
          placeholder="Bilal took 2 bags of flour 3200 and 1 cooking oil 1100, paid 2000 cash, rest udhaar"
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60" />
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="voice-lang">Voice language</label>
          <select id="voice-lang" value={lang} onChange={(e) => setLang(e.target.value as "en-PK" | "ur-PK" | "ps-AF")} className="rounded-xl border border-stone-300 bg-white px-2 py-3 text-sm">
            <option value="en-PK">English</option>
            <option value="ur-PK">Urdu</option>
            <option value="ps-AF">Pashto</option>
          </select>
          <VoiceRecorder language={lang} mode={apiMode === "none" ? "speech" : "gemini"} disabled={processing || !audioEnabled}
            onTranscript={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))}
            onAudio={(blob) => void submitVoiceNote(blob)} />
          <button type="submit" disabled={processing || !text.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </form>
      {processing ? (
        <div className="space-y-2" aria-label="Parsing entry">
          <div className="flex items-center gap-2 text-xs text-stone-500"><Sparkles className="h-3 w-3" /> {voiceNote ? "Gemini is listening to your voice note…" : "Parsing with Gemini…"}</div>
          <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-stone-200" />
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {answer ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{answer}</p> : null}
      {success ? <p role="status" className="text-sm text-emerald-700">Saved: {success}</p> : null}
      {!audioEnabled ? <p className="text-xs text-stone-500">Voice input is disabled by the Admin — typing still works.</p> : null}
    </div>
  );
}
