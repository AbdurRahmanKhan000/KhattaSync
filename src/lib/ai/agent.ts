import { GoogleGenAI } from "@google/genai";
import type { AiModel, ParsedLedgerResult, ThinkingBudget } from "../../types";
import { AGENT_REPLY_SCHEMA, AGENT_SYSTEM_PROMPT } from "./agent-schema";
import { repairParsedLedgerResult } from "../security";
import { AiError, aiErrorFrom, getGeminiClient, thinkingConfigFor } from "./index";
import { agentReplyJsonOpenAi } from "./openai";
import { agentReplyJsonClaude } from "./claude";
import type { AiProvider } from "./providers";

/**
 * The AI Agent — the conversational layer over the same ledger engine.
 * The shopkeeper talks (types or speaks); the agent answers from the
 * shop's real ledger snapshot, asks one short question when something is
 * missing, and returns a structured entry only when it is complete enough
 * to save. Same providers, same key, same repair + validation as the
 * fast Quick Record bar.
 */

export interface AgentHistoryItem {
  role: "user" | "agent";
  text: string;
}

export interface LedgerSnapshot {
  customers: { name: string; balance: number }[];
  totalUdhaar: number;
  collectedToday: number;
  totalCustomers: number;
}

export type AgentIntent = "answer" | "save_entry" | "clarify" | "off_topic";

export interface AgentReply {
  reply: string;
  intent: AgentIntent;
  entry: ParsedLedgerResult | null;
}

const AGENT_INTENTS: AgentIntent[] = ["answer", "save_entry", "clarify", "off_topic"];

/** Build the per-call user prompt: live snapshot + recent chat + the new message.
 *  The system instructions travel separately (systemInstruction / system
 *  field), so they are NOT repeated here. */
export function buildAgentPrompt(
  message: string,
  history: AgentHistoryItem[],
  snapshot: LedgerSnapshot,
): string {
  const lines = [
    "LEDGER SNAPSHOT (your only source of truth for balances — never invent numbers):",
    JSON.stringify({
      total_customers: snapshot.totalCustomers,
      total_udhaar_to_collect_pkr: snapshot.totalUdhaar,
      cash_collected_today_pkr: snapshot.collectedToday,
      customers: snapshot.customers.slice(0, 50).map((c) => ({ name: c.name, balance_pkr: c.balance })),
    }),
  ];
  if (history.length > 0) {
    lines.push("", "RECENT CONVERSATION:");
    for (const h of history.slice(-8)) lines.push(`${h.role === "user" ? "Shopkeeper" : "Agent"}: ${h.text}`);
  }
  lines.push("", `Shopkeeper now: ${message}`);
  return lines.join("\n");
}

/** Turn the model's JSON into a validated agent reply; repair the entry when one is present. */
export function parseAgentReply(raw: unknown): AgentReply {
  let data: unknown = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      throw new AiError("The agent did not return valid JSON.", "The agent did not return valid JSON.");
    }
  }
  const d = (data ?? {}) as { reply?: unknown; intent?: unknown; entry?: unknown };
  if (typeof d.reply !== "string" || d.reply.trim().length === 0) {
    throw new AiError("The agent returned an empty reply.", "The agent returned an empty reply.");
  }
  const intent: AgentIntent = AGENT_INTENTS.includes(d.intent as AgentIntent) ? (d.intent as AgentIntent) : "clarify";
  if (intent !== "save_entry" || d.entry == null) {
    return { reply: d.reply.trim(), intent, entry: null };
  }
  const repaired = repairParsedLedgerResult(d.entry);
  if (!repaired.ok || !repaired.result) {
    // The entry is not saveable yet — turn the specific problem into a question.
    const problem = repaired.error ?? "The entry is incomplete.";
    const question = /customer name/i.test(problem)
      ? "Who is this for?"
      : /amount|item/i.test(problem)
        ? "How much was it?"
        : "Could you say that again with the amount?";
    return { reply: `${d.reply.trim()} ${question}`, intent: "clarify", entry: null };
  }
  return { reply: d.reply.trim(), intent: "save_entry", entry: repaired.result };
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
}

/** One entry point: detect the provider once, dispatch, and return the agent's reply. */
export async function agentReplyWithProvider(
  message: string,
  history: AgentHistoryItem[],
  snapshot: LedgerSnapshot,
  opts: AgentOptions,
): Promise<AgentReply> {
  const prompt = buildAgentPrompt(message, history, snapshot);
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
