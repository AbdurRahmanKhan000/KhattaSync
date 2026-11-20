"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Send, Sparkles } from "lucide-react";
import type { AiKeyMode, CustomerAccount, LedgerEntry, ParsedLedgerResult } from "@/types";
import { DEFAULT_MODEL, PROVIDER_LABELS, detectProvider } from "@/lib/ai/providers";
import { buildLedgerSnapshot, callAgentApi } from "@/lib/agent-client";
import { describeActionResult, executeAgentActions } from "@/lib/agent-actions";
import type { AgentHistoryItem } from "@/lib/ai/agent";
import { notifyDataChanged } from "@/components/layout/DashboardContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { VoiceRecorder } from "./VoiceRecorder";

interface ChatMessage {
  role: "user" | "agent" | "system";
  text: string;
  detail?: string | null;
}

const SUGGESTIONS = [
  "What is the total credit?",
  "Add a new customer Bilal",
  "Faizan paid 500",
  "Zainab took 300 on credit",
];

/**
 * The AI Agent — a real agentic conversation with the ledger. The
 * shopkeeper types or speaks in plain English, Urdu, or Pashto; Gemini
 * (or the OpenAI/Claude key) answers in full from the shop's live
 * ledger snapshot, asks one short question when something is missing,
 * and returns a PLAN of actions — add a customer, save an entry, settle
 * a balance — that this component executes in order against IndexedDB
 * and reports back action by action, with the real new balance each
 * time. The agent can never delete anything: there is no delete action.
 */
export function AgentChat({ onParsed, apiKey, hostKeyAllowed, model, thinkingBudget, audioEnabled = true, apiMode, apiProvider, customers = [], transactions = [], totalUdhaar = 0, collectedToday = 0 }: {
  onParsed?: (result: ParsedLedgerResult, rawInput: string, source: "text" | "voice") => void;
  apiKey?: string; hostKeyAllowed?: boolean; model?: string; thinkingBudget?: string; audioEnabled?: boolean; apiMode?: AiKeyMode; apiProvider?: string;
  customers?: CustomerAccount[]; transactions?: LedgerEntry[]; totalUdhaar?: number; collectedToday?: number;
}) {
  const { lang, t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [speechLang, setSpeechLang] = useState<"en-PK" | "ur-PK" | "ps-AF">("en-PK");
  const [voiceNote, setVoiceNote] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const provider = apiKey ? detectProvider(apiKey) ?? "gemini" : "gemini";
  const providerKey = (apiProvider ?? provider) as keyof typeof PROVIDER_LABELS;
  const displayModel = model ?? DEFAULT_MODEL[providerKey] ?? "gemini-3.5-flash-lite";
  const voiceMode = apiMode === "none" || provider !== "gemini" ? "speech" : "audio";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  function snapshot() {
    return buildLedgerSnapshot({ customers, transactions, totalUdhaar, collectedToday });
  }

  function historyFrom(msgs: ChatMessage[]): AgentHistoryItem[] {
    return msgs
      .filter((m) => m.role === "user" || m.role === "agent")
      .slice(-8)
      .map((m) => ({ role: m.role as "user" | "agent", text: m.text }));
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (apiMode === "none") {
      setMessages((prev) => [...prev, { role: "user", text: trimmed }, { role: "agent", text: t("noKey") }]);
      setInput("");
      return;
    }
    const next = [...messages, { role: "user" as const, text: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const data = await callAgentApi({
        input: trimmed, history: historyFrom(next), snapshot: snapshot(),
        apiKey, hostKeyAllowed: hostKeyAllowed !== false, model, thinkingBudget, language: lang,
      });
      if (!data.ok || !data.reply) {
        setMessages((prev) => [...prev, { role: "agent", text: data.error ?? t("agentCouldNot"), detail: data.detail ?? null }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "agent", text: data.reply as string }]);
      // The plan: execute every action in order and report each real result.
      const actions = data.actions ?? (data.entry ? [{ type: "save_entry" as const, entry: data.entry }] : []);
      if (actions.length > 0) {
        const results = await executeAgentActions(actions, { customers, rawInput: trimmed, source: "text" });
        notifyDataChanged();
        const lines = results.map((r) => `${r.ok ? "✓" : "✗"} ${describeActionResult(r)}`);
        setMessages((prev) => [...prev, { role: "system", text: `${t("agentDone")}:\n${lines.join("\n")}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "agent", text: t("agentCouldNot") }]);
    } finally {
      setSending(false);
    }
  }

  /** Gemini voice-note path: audio -> Gemini transcribes + parses it. */
  async function submitVoiceNote(blob: Blob) {
    if (sending) return;
    if (apiMode === "none") {
      setMessages((prev) => [...prev, { role: "agent", text: t("noKey") }]);
      return;
    }
    setSending(true); setVoiceNote(true);
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
        setMessages((prev) => [...prev, { role: "agent", text: data.error ?? "Could not understand that voice note — try again, or type it.", detail: data.detail ?? null }]);
        return;
      }
      onParsed?.(data.parsed, "(voice note)", "voice");
      setMessages((prev) => [...prev,
        { role: "user", text: "(voice note)" },
        { role: "agent", text: t("heardSaved") },
        { role: "system", text: `${t("savedLabel")}: ${data.parsed?.customer_name} · ${data.parsed?.total_amount} PKR · ${data.parsed?.action_type}` },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "agent", text: "Voice note failed — check your connection or API key in Settings." }]);
    } finally { setSending(false); setVoiceNote(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Bot className="h-4 w-4 text-emerald-700" />
        <span>{t("talkingTo")} {PROVIDER_LABELS[providerKey] ?? "Gemini"} · {displayModel} — answers come from your ledger, nothing else.</span>
      </div>

      <div className="min-h-64 space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm font-medium text-stone-700">{t("askAnything")}</p>
            <p className="text-xs text-stone-500">{t("agentExamples")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} disabled={sending}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-emerald-600 hover:text-emerald-800 disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === "user" ? "bg-emerald-700 text-white"
              : m.role === "system" ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
              : "bg-white text-stone-800 ring-1 ring-stone-200"
            }`}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.detail ? <p className="mt-1 text-xs text-red-600">Provider said: {m.detail}</p> : null}
            </div>
          </div>
        ))}
        {sending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white px-4 py-2.5 text-sm text-stone-500 ring-1 ring-stone-200">
              <span className="inline-flex items-center gap-2"><Sparkles className="h-3 w-3" /> {voiceNote ? t("listeningNote") : `${t("thinkingWith")} ${PROVIDER_LABELS[providerKey] ?? "Gemini"}…`}</span>
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <label htmlFor="agent-input" className="sr-only">Ask the AI agent</label>
        <input id="agent-input" value={input} onChange={(e) => setInput(e.target.value)} disabled={sending}
          placeholder={t("askPlaceholder")}
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60" />
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="agent-voice-lang">Voice language</label>
          <select id="agent-voice-lang" value={speechLang} onChange={(e) => setSpeechLang(e.target.value as "en-PK" | "ur-PK" | "ps-AF")} className="rounded-xl border border-stone-300 bg-white px-2 py-3 text-sm">
            <option value="en-PK">English</option>
            <option value="ur-PK">Urdu</option>
            <option value="ps-AF">Pashto</option>
          </select>
          <VoiceRecorder language={speechLang} mode={voiceMode} disabled={sending || !audioEnabled}
            onTranscript={(txt) => setInput((prev) => (prev ? `${prev} ${txt}` : txt))}
            onAudio={(blob) => void submitVoiceNote(blob)} />
          <button type="submit" disabled={sending || !input.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
            <Send className="h-4 w-4" /> {t("send")}
          </button>
        </div>
      </form>
      {!audioEnabled ? <p className="text-xs text-stone-500">{t("voiceDisabled")}</p> : null}
      <p className="text-xs text-stone-400">{t("agentOnlyLedger")} <Link href="/app" className="text-emerald-700 underline">{t("backToDashboard")}</Link></p>
    </div>
  );
}
