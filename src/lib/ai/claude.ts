import type { ParsedLedgerResult } from "../../types";
import { LEDGER_RESPONSE_SCHEMA, LEDGER_SYSTEM_PROMPT } from "./ledger-schema";
import { AGENT_REPLY_SCHEMA, AGENT_SYSTEM_PROMPT } from "./agent-schema";
import { repairParsedLedgerResult } from "../security";

/**
 * Claude provider — Messages API with forced tool use. The tool's
 * input_schema is the ledger schema, so Claude must return the entry as a
 * structured tool call (same shape as Gemini/OpenAI). No SDK dependency:
 * plain fetch, server-side only. Claude has no audio input, so voice notes
 * are not offered for Claude keys — live speech transcription is used instead.
 */

export interface ClaudeOptions {
  apiKey: string;
  model: string;
}

const ANTHROPIC_VERSION = "2023-06-01";

interface ClaudeErrorBody {
  error?: { message?: string; type?: string };
}

/** Pull the provider's own error text out of a failed response (never the key). */
export async function claudeErrorText(res: Response): Promise<string> {
  const status = res.status;
  let message = "";
  try {
    const body = (await res.json()) as ClaudeErrorBody;
    message = body.error?.message ?? "";
  } catch {
    message = "";
  }
  return `Claude ${status}${message ? `: ${message}` : ""}`;
}

interface ClaudeMessageResponse {
  content?: { type: string; input?: unknown; text?: string }[];
}

export async function parseLedgerWithClaude(input: string, opts: ClaudeOptions): Promise<ParsedLedgerResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 1024,
      system: LEDGER_SYSTEM_PROMPT,
      tools: [
        {
          name: "record_ledger_entry",
          description: "Record one shop ledger entry (sale, purchase, payment, credit, inventory note, or reminder). Always call this tool; never answer in plain text.",
          input_schema: LEDGER_RESPONSE_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: "record_ledger_entry" },
      messages: [{ role: "user", content: `Input: ${input}` }],
    }),
  });
  if (!res.ok) throw new Error(await claudeErrorText(res));
  const data = (await res.json()) as ClaudeMessageResponse;
  const toolUse = data.content?.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.input === undefined) throw new Error("Claude did not return a ledger entry.");
  const repaired = repairParsedLedgerResult(toolUse.input);
  if (!repaired.ok || !repaired.result) throw new Error(repaired.error ?? "Claude output failed validation.");
  return repaired.result;
}

/** Agent call for Claude: forced tool use with the agent reply as the tool's input schema. */
export async function agentReplyJsonClaude(prompt: string, opts: ClaudeOptions): Promise<unknown> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 1024,
      system: AGENT_SYSTEM_PROMPT,
      tools: [
        {
          name: "agent_reply",
          description: "Reply to the shopkeeper as the KhattaSync AI agent: a short message, an intent, and a ledger entry only when it is complete enough to save.",
          input_schema: AGENT_REPLY_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: "agent_reply" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(await claudeErrorText(res));
  const data = (await res.json()) as ClaudeMessageResponse;
  const toolUse = data.content?.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.input === undefined) throw new Error("Claude did not return an agent reply.");
  return toolUse.input;
}

/** Cheap liveness probe for the Settings "Test" button: 5 output tokens, no ledger work. */
export async function pingClaude(opts: ClaudeOptions): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 5,
      messages: [{ role: "user", content: "Reply with the single word OK." }],
    }),
  });
  if (!res.ok) throw new Error(await claudeErrorText(res));
  const data = (await res.json()) as ClaudeMessageResponse;
  const textBlock = data.content?.find((b) => b.type === "text");
  return (textBlock?.text ?? "").trim();
}
