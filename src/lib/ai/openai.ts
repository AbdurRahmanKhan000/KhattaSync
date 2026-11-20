import type { ParsedLedgerResult } from "../../types";
import { LEDGER_RESPONSE_SCHEMA, LEDGER_SYSTEM_PROMPT } from "./ledger-schema";
import { AGENT_SYSTEM_PROMPT } from "./agent-schema";
import { repairParsedLedgerResult } from "../security";

/**
 * OpenAI provider — Chat Completions with strict json_schema response
 * format, so the model returns exactly the ledger shape (same schema and
 * system prompt as Gemini). No SDK dependency: plain fetch, server-side only.
 */

export interface OpenAiOptions {
  apiKey: string;
  model: string;
}

interface OpenAiErrorBody {
  error?: { message?: string; type?: string; code?: string };
}

/** Pull the provider's own error text out of a failed response (never the key). */
export async function openAiErrorText(res: Response): Promise<string> {
  const status = res.status;
  let message = "";
  try {
    const body = (await res.json()) as OpenAiErrorBody;
    message = body.error?.message ?? "";
  } catch {
    message = "";
  }
  return `OpenAI ${status}${message ? `: ${message}` : ""}`;
}

/** Parse a JSON string the model returned, then repair + validate it server-side. */
export function parseOpenAiJson(text: string): ParsedLedgerResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("OpenAI did not return valid JSON.");
  }
  const repaired = repairParsedLedgerResult(parsed);
  if (!repaired.ok || !repaired.result) throw new Error(repaired.error ?? "OpenAI output failed validation.");
  return repaired.result;
}

export async function parseLedgerWithOpenAi(input: string, opts: OpenAiOptions): Promise<ParsedLedgerResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: "system", content: LEDGER_SYSTEM_PROMPT },
        { role: "user", content: `Input: ${input}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "ledger_entry", schema: LEDGER_RESPONSE_SCHEMA, strict: true },
      },
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(await openAiErrorText(res));
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  return parseOpenAiJson(data.choices?.[0]?.message?.content ?? "");
}

/** Agent call for OpenAI: plain JSON object mode (the reply is conversational, so strict schema is unnecessary — the server validates it). */
export async function agentReplyJsonOpenAi(prompt: string, opts: OpenAiOptions): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: "system", content: AGENT_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(await openAiErrorText(res));
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenAI did not return a reply.");
  return text;
}
export async function pingOpenAi(opts: OpenAiOptions): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [{ role: "user", content: "Reply with the single word OK." }],
      max_tokens: 5,
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(await openAiErrorText(res));
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}
