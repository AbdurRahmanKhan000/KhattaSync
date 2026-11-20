import { GoogleGenAI } from "@google/genai";
import type { AiModel, ParsedLedgerResult, ThinkingBudget } from "../../types";
import { AGENT_REPLY_SCHEMA, AGENT_SYSTEM_PROMPT } from "./agent-schema";
import { repairParsedLedgerResult } from "../security";
import { AiError, aiErrorFrom, getGeminiClient, thinkingConfigFor } from "./index";
import { agentReplyJsonOpenAi } from "./openai";
import { agentReplyJsonClaude } from "./claude";
import type { AiProvider } from "./providers";

/**
 * The AI Agent, v2 — AGENTIC. The shopkeeper talks (types or speaks);
 * the agent answers in full from the shop's real ledger snapshot, asks
 * one short question when something is missing, and returns a PLAN of
 * actions (add a customer, save an entry, settle a balance) that the app
 * executes in order against the IndexedDB ledger. Same providers, same
 * key, same repair + validation as the fast Quick Record bar — and the
 * agent can never delete anything, because there is no delete action.
 */

export interface AgentHistoryItem {
  role: "user" | "agent";
  text: string;
}

export interface SnapshotEntry {
  date: string;
  type: "gave" | "got";
  amount: number;
  note?: string;
}

export interface LedgerSnapshot {
  customers: { name: string; balance: number; recent: SnapshotEntry[] }[];
  totalUdhaar: number;
  collectedToday: number;
  totalCustomers: number;
}

export type AgentAction =
  | { type: "create_customer"; customer_name: string }
  | { type: "save_entry"; entry: ParsedLedgerResult }
  | { type: "settle_balance"; customer_name: string; amount?: number | null };

export type AgentIntent = "answer" | "act" | "clarify" | "off_topic";

export interface AgentReply {
  reply: string;
  intent: AgentIntent;
  actions: AgentAction[];
}

const AGENT_INTENTS: AgentIntent[] = ["answer", "act", "clarify", "off_topic"];

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", ur: "Urdu", ps: "Pashto", pa: "Punjabi", sd: "Sindhi", ar: "Arabic", hi: "Hindi",
};

/** Build the per-call user prompt: live snapshot + reply language + recent chat + the new message.
 *  The system instructions travel separately (systemInstruction / system
 *  field), so they are NOT repeated here. */
export function buildAgentPrompt(
  message: string,
  history: AgentHistoryItem[],
  snapshot: LedgerSnapshot,
  language = "en",
): string {
  const lines = [
    `REPLY LANGUAGE: ${LANGUAGE_NAMES[language] ?? "English"} (match the shopkeeper's own words first if they wrote in another language).`,
    "",
    "LEDGER SNAPSHOT (your only source of truth for balances — never invent numbers):",
    JSON.stringify({
      total_customers: snapshot.totalCustomers,
      total_credit_to_collect_pkr: snapshot.totalUdhaar,
      cash_collected_today_pkr: snapshot.collectedToday,
      customers: snapshot.customers.slice(0, 30).map((c) => ({
        name: c.name,
        balance_pkr: c.balance,
        recent_entries: (c.recent ?? []).slice(0, 3).map((e) => ({
          date: e.date,
          type: e.type === "got" ? "payment_received" : "credit_given",
          amount_pkr: e.amount,
          ...(e.note ? { note: e.note } : {}),
        })),
      })),
    }),
  ];
  if (history.length > 0) {
    lines.push("", "RECENT CONVERSATION:");
    for (const h of history.slice(-8)) lines.push(`${h.role === "user" ? "Shopkeeper" : "Agent"}: ${h.text}`);
  }
  lines.push("", `Shopkeeper now: ${message}`);
  return lines.join("\n");
}

function clarifyQuestion(problem: string): string {
  if (/customer name/i.test(problem)) return "Who is this for?";
  if (/amount|item/i.test(problem)) return "How much was it?";
  return "Could you say that again with the amount?";
}

/** Validate one planned action; returns null when the action is sound. */
function validateAction(raw: unknown): { action: AgentAction } | { error: string } {
  const a = (raw ?? {}) as { type?: unknown; customer_name?: unknown; amount?: unknown; entry?: unknown };
  if (a.type === "create_customer") {
    if (typeof a.customer_name !== "string" || a.customer_name.trim().length === 0) {
      return { error: "The customer name is missing." };
    }
    return { action: { type: "create_customer", customer_name: a.customer_name.trim() } };
  }
  if (a.type === "save_entry") {
    const repaired = repairParsedLedgerResult(a.entry);
    if (!repaired.ok || !repaired.result) {
      return { error: repaired.error ?? "The entry is incomplete." };
    }
    return { action: { type: "save_entry", entry: repaired.result } };
  }
  if (a.type === "settle_balance") {
    if (typeof a.customer_name !== "string" || a.customer_name.trim().length === 0) {
      return { error: "The customer name is missing." };
    }
    if (a.amount != null && (typeof a.amount !== "number" || !Number.isFinite(a.amount) || a.amount <= 0)) {
      return { error: "The settle amount is not a valid amount." };
    }
    return { action: { type: "settle_balance", customer_name: a.customer_name.trim(), amount: a.amount ?? null } };
  }
  return { error: "The agent planned an action this app does not support." };
}

/** Turn the model's JSON into a validated agent reply.
 *  The plan is atomic: if ANY action fails validation, nothing is
 *  executed — the reply becomes a clarifying question about the exact
 *  problem, so the agent never acts on a half-broken plan. The v1 shape
 *  (intent "save_entry" + a top-level entry) is still accepted and
 *  converted to a one-action plan. */
export function parseAgentReply(raw: unknown): AgentReply {
  let data: unknown = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      throw new AiError("The agent did not return valid JSON.", "The agent did not return valid JSON.");
    }
  }
  const d = (data ?? {}) as { reply?: unknown; intent?: unknown; actions?: unknown; entry?: unknown };
  if (typeof d.reply !== "string" || d.reply.trim().length === 0) {
    throw new AiError("The agent returned an empty reply.", "The agent returned an empty reply.");
  }
  const reply = d.reply.trim();
  // Legacy v1: intent "save_entry" + top-level entry -> one save action.
  const legacyEntry = d.intent === "save_entry" && d.entry != null ? [{ type: "save_entry", entry: d.entry }] : null;
  const rawActions: unknown[] = legacyEntry ?? (Array.isArray(d.actions) ? d.actions : []);
  let intent: AgentIntent = AGENT_INTENTS.includes(d.intent as AgentIntent)
    ? (d.intent as AgentIntent)
    : legacyEntry
      ? "act"
      : "clarify";
  if (intent === "act" && rawActions.length === 0) intent = "clarify";
  if (intent !== "act") {
    return { reply, intent, actions: [] };
  }
  const actions: AgentAction[] = [];
  for (const rawAction of rawActions) {
    const checked = validateAction(rawAction);
    if ("error" in checked) {
      return { reply: `${reply} ${clarifyQuestion(checked.error)}`, intent: "clarify", actions: [] };
    }
    actions.push(checked.action);
  }
  if (actions.length === 0) return { reply, intent: "clarify", actions: [] };
  return { reply, intent: "act", actions };
}

async function agentReplyWithGemini(
  prompt: string,
  opts: { apiKey: string; model: AiModel; thinkingBudget: ThinkingBudget },
): Promise<AgentReply> {
  const ai: GoogleGenAI = getGeminiClient(opts.apiKey);
  const res = await ai.models.generateContent({
    model: opts.model,
    contents: prompt,
    config: {
      systemInstruction: AGENT_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: AGENT_REPLY_SCHEMA,
      ...thinkingConfigFor(opts.model, opts.thinkingBudget),
    },
  });
  return parseAgentReply(res.text ?? "");
}

export interface AgentOptions {
  apiKey: string;
  provider: AiProvider;
  model?: AiModel;
  thinkingBudget?: ThinkingBudget;
  language?: string;
}

/** One entry point: detect the provider once, dispatch, and return the agent's reply. */
export async function agentReplyWithProvider(
  message: string,
  history: AgentHistoryItem[],
  snapshot: LedgerSnapshot,
  opts: AgentOptions,
): Promise<AgentReply> {
  const prompt = buildAgentPrompt(message, history, snapshot, opts.language ?? "en");
  const model = opts.model ?? "gemini-3.5-flash-lite";
  const budget = opts.thinkingBudget ?? "standard";
  try {
    if (opts.provider === "openai") {
      return parseAgentReply(await agentReplyJsonOpenAi(prompt, { apiKey: opts.apiKey, model }));
    }
    if (opts.provider === "claude") {
      return parseAgentReply(await agentReplyJsonClaude(prompt, { apiKey: opts.apiKey, model }));
    }
    return await agentReplyWithGemini(prompt, { apiKey: opts.apiKey, model, thinkingBudget: budget });
  } catch (err) {
    throw aiErrorFrom(err, opts.provider);
  }
}
