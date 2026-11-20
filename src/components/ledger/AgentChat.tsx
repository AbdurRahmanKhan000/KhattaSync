"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Send, Sparkles } from "lucide-react";
import type { AiKeyMode, CustomerAccount, ParsedLedgerResult } from "@/types";
import { DEFAULT_MODEL, PROVIDER_LABELS, detectProvider } from "@/lib/ai/providers";
import { buildLedgerSnapshot, callAgentApi } from "@/lib/agent-client";
import type { AgentHistoryItem } from "@/lib/ai/agent";
import { VoiceRecorder } from "./VoiceRecorder";

interface ChatMessage {
  role: "user" | "agent" | "system";
  text: string;
  detail?: string | null;
}

const SUGGESTIONS = [
  "What is the total credit?",
  "Zainab took 300 udhaar",
  "Ahmad bought one kilo onion and will pay after 3 days",
];

/**
 * The AI Agent — a real conversation with the khata, not a store-and-see
 * form. The shopkeeper types or speaks; Gemini (or the OpenAI/Claude key)
 * answers from the shop's live ledger snapshot, asks one short question
 * when something is missing, and saves the entry the moment it is
 * complete. Saving goes through the exact same code as Quick Record.
 */
export function AgentChat({ onParsed, apiKey, hostKeyAllowed, model, thinkingBudget, audioEnabled = true, apiMode, apiProvider, customers = [], totalUdhaar = 0, collectedToday = 0 }: {
  onParsed?: (result: ParsedLedgerResult, rawInput: string, source: "text" | "voice") => void;
  apiKey?: string; hostKeyAllowed?: boolean; model?: string; thinkingBudget?: string; audioEnabled?: boolean; apiMode?: AiKeyMode; apiProvider?: string;
  customers?: CustomerAccount[]; totalUdhaar?: number; collectedToday?: number;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lang, setLang] = useState<"en-PK" | "ur-PK" | "ps-AF">("en-PK");
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
    return buildLedgerSnapshot({ customers, totalUdhaar, collectedToday });
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
      setMessages((prev) => [...prev, { role: "user", text: trimmed }, { role: "agent", text: "No AI key available — add your AI key in Settings, or ask the Admin to restore the host key." }]);
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
        apiKey, hostKeyAllowed: hostKeyAllowed !== false, model, thinkingBudget,
      });
      if (!data.ok || !data.reply) {
        setMessages((prev) => [...prev, { role: "agent", text: data.error ?? "The agent could not answer — please try again.", detail: data.detail ?? null }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "agent", text: data.reply as string }]);
      if (data.entry) {
        onParsed?.(data.entry, trimmed, "text");
        setMessages((prev) => [...prev, { role: "system", text: `Saved: ${data.entry?.customer_name} · ${data.entry?.total_amount} PKR · ${data.entry?.action_type}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "agent", text: "The agent could not be reached — check your connection or API key in Settings." }]);
    } finally {
      setSending(false);
    }
  }

  /** Gemini voice-note path: audio -> Gemini transcribes + parses it. */
  async function submitVoiceNote(blob: Blob) {
    if (sending) return;
    if (apiMode === "none") {
      setMessages((prev) => [...prev, { role: "agent", text: "No AI key available — add your AI key in Settings, or ask the Admin to restore the host key." }]);
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
        { role: "agent", text: `Heard it and saved it.` },
        { role: "system", text: `Saved: ${data.parsed?.customer_name} · ${data.parsed?.total_amount} PKR · ${data.parsed?.action_type}` },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "agent", text: "Voice note failed — check your connection or API key in Settings." }]);
    } finally { setSending(false); setVoiceNote(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Bot className="h-4 w-4 text-emerald-700" />
        <span>Talking to {PROVIDER_LABELS[providerKey] ?? "Gemini"} · {displayModel} — answers come from your khata, nothing else.</span>
      </div>

      <div className="min-h-64 space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm font-medium text-stone-700">Ask anything about your khata — or just say what happened.</p>
            <p className="text-xs text-stone-500">“What does Bibi Zainab owe?” · “Zainab took 300 udhaar” · “Ahmad bought onion, will pay in 3 days”</p>
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
              <span className="inline-flex items-center gap-2"><Sparkles className="h-3 w-3" /> {voiceNote ? "Gemini is listening to your voice note…" : `Thinking with ${PROVIDER_LABELS[providerKey] ?? "Gemini"}…`}</span>
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <label htmlFor="agent-input" className="sr-only">Ask the AI agent</label>
        <input id="agent-input" value={input} onChange={(e) => setInput(e.target.value)} disabled={sending}
          placeholder="Ask about your khata, or say what happened — e.g. Zainab took 300 udhaar"
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60" />
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="agent-voice-lang">Voice language</label>
          <select id="agent-voice-lang" value={lang} onChange={(e) => setLang(e.target.value as "en-PK" | "ur-PK" | "ps-AF")} className="rounded-xl border border-stone-300 bg-white px-2 py-3 text-sm">
            <option value="en-PK">English</option>
            <option value="ur-PK">Urdu</option>
            <option value="ps-AF">Pashto</option>
          </select>
          <VoiceRecorder language={lang} mode={voiceMode} disabled={sending || !audioEnabled}
            onTranscript={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
            onAudio={(blob) => void submitVoiceNote(blob)} />
          <button type="submit" disabled={sending || !input.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
            <Send className="h-4 w-4" /> Send
          </button>
        </div>
      </form>
      {!audioEnabled ? <p className="text-xs text-stone-500">Voice input is disabled by the Admin — typing still works.</p> : null}
      <p className="text-xs text-stone-400">The agent only knows your khata — it answers from the balances in this browser and never invents a number. <Link href="/" className="text-emerald-700 underline">Back to Dashboard</Link></p>
    </div>
  );
}
