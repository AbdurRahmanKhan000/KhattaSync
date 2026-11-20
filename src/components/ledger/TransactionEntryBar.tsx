"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import type { AiKeyMode, CustomerAccount, LedgerEntry, ParsedLedgerResult } from "@/types";
import { answerLedgerQuery } from "@/lib/ledger-query";
import { buildLedgerSnapshot, callAgentApi } from "@/lib/agent-client";
import { describeActionResult, executeAgentActions } from "@/lib/agent-actions";
import { PROVIDER_LABELS, detectProvider } from "@/lib/ai/providers";
import { notifyDataChanged } from "@/components/layout/DashboardContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { VoiceRecorder } from "./VoiceRecorder";

export function TransactionEntryBar({ onParsed, apiKey, hostKeyAllowed, model, thinkingBudget, audioEnabled = true, apiMode, customers = [], transactions = [], totalUdhaar = 0, collectedToday = 0 }: {
  onParsed?: (result: ParsedLedgerResult, rawInput: string, source: "text" | "voice") => void;
  apiKey?: string; hostKeyAllowed?: boolean; model?: string; thinkingBudget?: string; audioEnabled?: boolean; apiMode?: AiKeyMode;
  customers?: CustomerAccount[]; transactions?: LedgerEntry[]; totalUdhaar?: number; collectedToday?: number;
}) {
  const { lang, t } = useLanguage();
  const [text, setText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [agentReply, setAgentReply] = useState<string | null>(null);
  const [agentDetail, setAgentDetail] = useState<string | null>(null);
  const [askingAgent, setAskingAgent] = useState(false);
  const [speechLang, setSpeechLang] = useState<"en-PK" | "ur-PK" | "ps-AF">("en-PK");
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
      showError(t("noKey"));
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
   *  let the agent handle it — Gemini asks for the missing price, or acts
   *  straight away when the message is a complete job ("Add Bilal",
   *  "Faizan paid 500"). The text stays in the box when the agent asks,
   *  so the shopkeeper can add the amount the agent asks for and tap Add. */
  async function askAgent(input: string) {
    setProcessing(true); setAskingAgent(true); setError(null); setErrorDetail(null); setSuccess(null); setAgentReply(null); setAgentDetail(null);
    try {
      const data = await callAgentApi({
        input, history: [], snapshot: buildLedgerSnapshot({ customers, transactions, totalUdhaar, collectedToday }),
        apiKey, hostKeyAllowed: hostKeyAllowed !== false, model, thinkingBudget, language: lang,
      });
      if (!data.ok || !data.reply) {
        showError(data.error ?? t("agentCouldNot"), data.detail ?? undefined);
        return;
      }
      setAgentReply(data.reply);
      setAgentDetail(null);
      const actions = data.actions ?? (data.entry ? [{ type: "save_entry" as const, entry: data.entry }] : []);
      if (actions.length > 0) {
        const results = await executeAgentActions(actions, { customers, rawInput: input, source: "text" });
        notifyDataChanged();
        setSuccess(results.map((r) => `${r.ok ? "✓" : "✗"} ${describeActionResult(r)}`).join(" · "));
        setText("");
      }
    } catch {
      showError(t("agentCouldNot"));
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
      showError(t("noKey"));
      return;
    }
    // 2) No amount and no question: the agent asks for the missing price
    //    — or acts at once when the message is a complete job.
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
          placeholder={t("barPlaceholder")}
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60" />
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="voice-lang">Voice language</label>
          <select id="voice-lang" value={speechLang} onChange={(e) => setSpeechLang(e.target.value as "en-PK" | "ur-PK" | "ps-AF")} className="rounded-xl border border-stone-300 bg-white px-2 py-3 text-sm">
            <option value="en-PK">English</option>
            <option value="ur-PK">Urdu</option>
            <option value="ps-AF">Pashto</option>
          </select>
          <VoiceRecorder language={speechLang} mode={voiceMode} disabled={processing || !audioEnabled}
            onTranscript={(txt) => setText((prev) => (prev ? `${prev} ${txt}` : txt))}
            onAudio={(blob) => void submitVoiceNote(blob)} />
          <button type="submit" disabled={processing || !text.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
            <Plus className="h-4 w-4" /> {t("add")}
          </button>
        </div>
      </form>
      {processing ? (
        <div className="space-y-2" aria-label="Parsing entry">
          <div className="flex items-center gap-2 text-xs text-stone-500"><Sparkles className="h-3 w-3" /> {voiceNote ? t("listeningNote") : askingAgent ? `${t("askingAgent")} (${PROVIDER_LABELS[provider]})…` : `${t("parsingWith")} ${PROVIDER_LABELS[provider]}…`}</div>
          <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-stone-200" />
        </div>
      ) : null}
      {agentReply ? (
        <div role="status" className="rounded-xl bg-white px-4 py-3 text-sm text-stone-800 ring-1 ring-stone-200">
          <p className="text-xs font-semibold text-emerald-800">{t("navAgent")} · {PROVIDER_LABELS[provider]}</p>
          <p className="mt-1 whitespace-pre-wrap">{agentReply}</p>
          {agentDetail ? <p className="mt-1 text-xs text-red-600">Provider said: {agentDetail}</p> : null}
          <p className="mt-2 text-xs text-stone-500">{t("agentAddAmount")} <Link href="/agent" className="font-medium text-emerald-700 underline">{t("continueInAgent")}</Link>.</p>
        </div>
      ) : null}
      {error ? (
        <div role="alert">
          <p className="text-sm text-red-700">{error}</p>
          {errorDetail ? <p className="mt-1 text-xs text-red-600">Provider said: {errorDetail}</p> : null}
        </div>
      ) : null}
      {answer ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{answer}</p> : null}
      {success ? <p role="status" className="text-sm text-emerald-700">{t("savedLabel")}: {success}</p> : null}
      {!audioEnabled ? <p className="text-xs text-stone-500">{t("voiceDisabled")}</p> : null}
    </div>
  );
}
