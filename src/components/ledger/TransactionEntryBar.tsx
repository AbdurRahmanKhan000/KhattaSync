"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import type { AiKeyMode, CustomerAccount, ParsedLedgerResult } from "@/types";
import { answerLedgerQuery } from "@/lib/ledger-query";
import { buildLedgerSnapshot, callAgentApi } from "@/lib/agent-client";
import { PROVIDER_LABELS, detectProvider } from "@/lib/ai/providers";
import { VoiceRecorder } from "./VoiceRecorder";

export function TransactionEntryBar({ onParsed, apiKey, hostKeyAllowed, model, thinkingBudget, audioEnabled = true, apiMode, customers = [], totalUdhaar = 0, collectedToday = 0 }: {
  onParsed?: (result: ParsedLedgerResult, rawInput: string, source: "text" | "voice") => void;
  apiKey?: string; hostKeyAllowed?: boolean; model?: string; thinkingBudget?: string; audioEnabled?: boolean; apiMode?: AiKeyMode;
  customers?: CustomerAccount[]; totalUdhaar?: number; collectedToday?: number;
}) {
  const [text, setText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [agentReply, setAgentReply] = useState<string | null>(null);
  const [agentDetail, setAgentDetail] = useState<string | null>(null);
  const [askingAgent, setAskingAgent] = useState(false);
  const [lang, setLang] = useState<"en-PK" | "ur-PK" | "ps-AF">("en-PK");
  const [voiceNote, setVoiceNote] = useState(false);

  // Which AI is behind this bar: the host key is Gemini; a personal key is
  // detected from the key itself. Only Gemini transcribes raw audio — an
  // OpenAI or Claude key uses live speech transcription instead.
  const provider = apiKey ? detectProvider(apiKey) ?? "gemini" : "gemini";
  const voiceMode = apiMode === "none" || provider !== "gemini" ? "speech" : "audio";

  function showError(message: string, detail?: string) {
    setError(message);
    setErrorDetail(detail ?? null);
  }

  /** Gemini voice-note path: audio -> Gemini transcribes + parses it. */
  async function submitVoiceNote(blob: Blob) {
    if (processing) return;
    if (apiMode === "none") {
      showError("No AI key available — add your AI key in Settings, or ask the Admin to restore the host key.");
      return;
    }
    setProcessing(true); setVoiceNote(true); setError(null); setErrorDetail(null); setSuccess(null);
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
      const data = (await res.json()) as { ok?: boolean; error?: string; detail?: string; parsed?: ParsedLedgerResult };
      if (!res.ok || !data.parsed?.is_valid_ledger_entry) {
        showError(data.error ?? "Could not understand that voice note — try again, or type the entry.", data.detail);
        return;
      }
      setSuccess(`${data.parsed.customer_name} · ${data.parsed.total_amount} PKR · ${data.parsed.action_type}`);
      setAnswer(null);
      onParsed?.(data.parsed, "(voice note)", "voice");
    } catch {
      showError("Voice note failed — check your connection or API key in Settings.");
    } finally { setProcessing(false); setVoiceNote(false); }
  }

  /** No amount yet (e.g. "Ahmad bought one kilo onion, will pay in 3 days"):
   *  let the agent ask for the missing price — Gemini talks back instead
   *  of the bar dead-ending with a rule. The text stays in the box so the
   *  shopkeeper can add the amount the agent asks for and tap Add. */
  async function askAgent(input: string) {
    setProcessing(true); setAskingAgent(true); setError(null); setErrorDetail(null); setSuccess(null); setAgentReply(null); setAgentDetail(null);
    try {
      const data = await callAgentApi({
        input, history: [], snapshot: buildLedgerSnapshot({ customers, totalUdhaar, collectedToday }),
        apiKey, hostKeyAllowed: hostKeyAllowed !== false, model, thinkingBudget,
      });
      if (!data.ok || !data.reply) {
        showError(data.error ?? "The agent could not answer — please try again.", data.detail ?? undefined);
        return;
      }
      setAgentReply(data.reply);
      setAgentDetail(null);
      if (data.entry) {
        setSuccess(`${data.entry.customer_name} · ${data.entry.total_amount} PKR · ${data.entry.action_type}`);
        onParsed?.(data.entry, input, "text");
        setText("");
      }
    } catch {
      showError("The agent could not be reached — check your connection or API key in Settings.");
    } finally {
      setProcessing(false); setAskingAgent(false);
    }
  }

  async function submit(raw: string, source: "text" | "voice") {
    const input = raw.trim();
    if (!input || processing) return;
    // 1) Balance questions are answered instantly from the local ledger.
    const localAnswer = answerLedgerQuery(input, { customers, totalUdhaar, collectedToday });
    if (localAnswer) {
      setAnswer(localAnswer); setError(null); setErrorDetail(null); setSuccess(null); setAgentReply(null); setText("");
      return;
    }
    if (apiMode === "none") {
      showError("No AI key available — add your AI key in Settings, or ask the Admin to restore the host key.");
      return;
    }
    // 2) No amount and no question: the agent asks for the missing price
    //    instead of rejecting a hurried shopkeeper with a dead-end rule.
    if (!/\d/.test(input)) {
      await askAgent(input);
      return;
    }
    setProcessing(true); setError(null); setErrorDetail(null); setSuccess(null); setAgentReply(null);
    try {
      const res = await fetch("/api/parse-ledger", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, apiKey, hostKeyAllowed: hostKeyAllowed !== false, model, thinkingBudget }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; detail?: string; parsed?: ParsedLedgerResult };
      if (!res.ok || !data.parsed?.is_valid_ledger_entry) {
        showError(data.error ?? "Could not parse that entry. Try: name, amount, gave or got.", data.detail);
        return;
      }
      setSuccess(`${data.parsed.customer_name} · ${data.parsed.total_amount} PKR · ${data.parsed.action_type}`);
      setAnswer(null);
      onParsed?.(data.parsed, input, source);
      setText("");
    } catch {
      showError("AI parsing failed — check your connection or API key in Settings.");
    } finally { setProcessing(false); }
  }

  return (
    <div className="space-y-2">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void submit(text, "text"); }}>
        <label htmlFor="ledger-entry" className="sr-only">Quick-record a ledger entry</label>
        <input id="ledger-entry" value={text} onChange={(e) => { setText(e.target.value); setAnswer(null); setAgentReply(null); }} disabled={processing}
          placeholder="Bilal took 2 bags of flour 3200 and 1 cooking oil 1100, paid 2000 cash, rest udhaar"
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60" />
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="voice-lang">Voice language</label>
          <select id="voice-lang" value={lang} onChange={(e) => setLang(e.target.value as "en-PK" | "ur-PK" | "ps-AF")} className="rounded-xl border border-stone-300 bg-white px-2 py-3 text-sm">
            <option value="en-PK">English</option>
            <option value="ur-PK">Urdu</option>
            <option value="ps-AF">Pashto</option>
          </select>
          <VoiceRecorder language={lang} mode={voiceMode} disabled={processing || !audioEnabled}
            onTranscript={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))}
            onAudio={(blob) => void submitVoiceNote(blob)} />
          <button type="submit" disabled={processing || !text.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </form>
      {processing ? (
        <div className="space-y-2" aria-label="Parsing entry">
          <div className="flex items-center gap-2 text-xs text-stone-500"><Sparkles className="h-3 w-3" /> {voiceNote ? "Gemini is listening to your voice note…" : askingAgent ? `Asking the agent (${PROVIDER_LABELS[provider]})…` : `Parsing with ${PROVIDER_LABELS[provider]}…`}</div>
          <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-stone-200" />
        </div>
      ) : null}
      {agentReply ? (
        <div role="status" className="rounded-xl bg-white px-4 py-3 text-sm text-stone-800 ring-1 ring-stone-200">
          <p className="text-xs font-semibold text-emerald-800">AI Agent · {PROVIDER_LABELS[provider]}</p>
          <p className="mt-1 whitespace-pre-wrap">{agentReply}</p>
          {agentDetail ? <p className="mt-1 text-xs text-red-600">Provider said: {agentDetail}</p> : null}
          <p className="mt-2 text-xs text-stone-500">Add the amount above and tap Add — or <Link href="/agent" className="font-medium text-emerald-700 underline">continue in the AI Agent</Link>.</p>
        </div>
      ) : null}
      {error ? (
        <div role="alert">
          <p className="text-sm text-red-700">{error}</p>
          {errorDetail ? <p className="mt-1 text-xs text-red-600">Provider said: {errorDetail}</p> : null}
        </div>
      ) : null}
      {answer ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{answer}</p> : null}
      {success ? <p role="status" className="text-sm text-emerald-700">Saved: {success}</p> : null}
      {!audioEnabled ? <p className="text-xs text-stone-500">Voice input is disabled by the Admin — typing still works.</p> : null}
    </div>
  );
}
