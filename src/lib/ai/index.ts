import { GoogleGenAI } from "@google/genai";
import type { AiKeyMode, AiModel, ParsedLedgerResult, ThinkingBudget } from "../../types";
import { DEFAULT_AI_MODEL } from "../../constants";
import { repairParsedLedgerResult } from "../security";
import { LEDGER_RESPONSE_SCHEMA, LEDGER_SYSTEM_PROMPT } from "./ledger-schema";
import { DEFAULT_MODEL, detectProvider, modelForProvider, type AiProvider } from "./providers";
import { parseLedgerWithOpenAi, pingOpenAi } from "./openai";
import { parseLedgerWithClaude, pingClaude } from "./claude";

export { LEDGER_RESPONSE_SCHEMA, LEDGER_SYSTEM_PROMPT } from "./ledger-schema";

/**
 * KhattaSync AI — structured ledger parsing ONLY. No chat.
 * One key bar accepts Gemini, OpenAI, or Claude; the provider is detected
 * from the key. Every provider gets the same schema + system prompt and the
 * same server-side repair + validation, so an entry saves the same way
 * whichever key the shopkeeper pasted.
 */
export const GEMINI_MODEL: AiModel = DEFAULT_AI_MODEL;
export const ALLOWED_MODELS: AiModel[] = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];

export const THINKING_BUDGETS: Record<ThinkingBudget, number> = {
  low: 0,
  standard: 512,
  high: 2048,
};

/**
 * Gemini 3 models take thinkingLevel ("low"/"high"), not thinkingBudget —
 * sending a budget to a 3.x model can make the whole call fail with a 400.
 * Gemini 2.x models take thinkingBudget. Standard = default (omit it).
 */
export function thinkingConfigFor(model: string, budget: ThinkingBudget): Record<string, unknown> {
  if (/^gemini-3/.test(model)) {
    if (budget === "low") return { thinkingConfig: { thinkingLevel: "low" } };
    if (budget === "high") return { thinkingConfig: { thinkingLevel: "high" } };
    return {};
  }
  return { thinkingConfig: { thinkingBudget: THINKING_BUDGETS[budget] } };
}

/** Is this error a "model not found" (404 / NOT_FOUND) from the provider? */
export function isModelNotFoundError(err: unknown): boolean {
  const e = err as { status?: number; code?: string; message?: string } | null;
  const text = `${e?.status ?? ""} ${e?.code ?? ""} ${e?.message ?? ""}`;
  return /404|NOT_FOUND|is not found|not found for API version|model .* does not exist|The model .* does not exist/i.test(text);
}

export function getGeminiClient(apiKey: string): GoogleGenAI {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  return new GoogleGenAI({ apiKey });
}

export interface ResolveKeyInput {
  /** False when the Admin withdrew the host key (BYOK enforced). */
  hostKeyAllowed: boolean;
  userApiKey?: string;
  serverKey?: string;
}

export interface ResolveKeyResult {
  mode: AiKeyMode;
  apiKey?: string;
  /** Null when a user key is present but its provider cannot be recognised. */
  provider: AiProvider | null;
}

/**
 * Flexible key architecture:
 *  - user key present  -> Personal User API Key (BYOK), always wins; provider detected from the key
 *  - else host allowed + server key -> Host Hosted Key (Gemini)
 *  - else -> none (UI must guide the user to Settings to enter a key)
 * The server key is never sent to the browser; the user key is only ever
 * sent per-request from the browser to this server route, never stored server-side.
 */
export function resolveAiKey(input: ResolveKeyInput): ResolveKeyResult {
  const userKey = input.userApiKey?.trim();
  if (userKey) return { mode: "personal", apiKey: userKey, provider: detectProvider(userKey) };
  if (input.hostKeyAllowed && input.serverKey?.trim()) {
    return { mode: "host", apiKey: input.serverKey.trim(), provider: "gemini" };
  }
  return { mode: "none", provider: null };
}

export interface ParseLedgerOptions {
  apiKey: string;
  model?: AiModel;
  thinkingBudget?: ThinkingBudget;
}

/**
 * The provider's raw error text, made safe to show the user: truncated, and
 * anything that looks like a key redacted. This is what the UI shows under
 * the friendly message — a failure must never again hide its real cause
 * behind a generic "AI parsing failed".
 */
export function sanitizeAiErrorDetail(err: unknown): string {
  // Structured errors carry the raw provider text with them — that is the
  // detail. Never show the friendly message as its own "Provider said:".
  if (err instanceof AiError) return err.detail;
  const e = err as { status?: number; code?: string; message?: string } | null;
  const raw = `${e?.status ? `${e.status} ` : ""}${e?.code ? `${e.code}: ` : ""}${e?.message ?? ""}`.trim();
  const redacted = raw
    .replace(/(AIza[0-9A-Za-z\-_]{10,})/g, "[key]")
    .replace(/(AQ\.[0-9A-Za-z\-_]{10,})/g, "[key]")
    .replace(/(sk-(?:ant-|proj-)?[0-9A-Za-z\-_]{10,})/g, "[key]")
    .replace(/(Bearer\s+)[^\s]+/gi, "$1[key]");
  return redacted.slice(0, 300) || "Unknown error";
}

/**
 * A failed AI call keeps TWO texts: the friendly message the shopkeeper
 * sees, and the provider's raw error (its real cause) shown under it.
 * Before this, the wrappers threw `new Error(friendly message)`, which
 * destroyed the raw cause — so a real failure showed up as
 * "AI parsing failed — please try again." with "Provider said:" echoing
 * the same generic line. That must never happen again.
 */
export class AiError extends Error {
  detail: string;
  constructor(friendly: string, detail: string) {
    super(friendly);
    this.name = "AiError";
    this.detail = detail;
  }
}

/** Wrap any raw failure once: friendly message up front, raw cause kept as detail. */
export function aiErrorFrom(err: unknown, provider: AiProvider = "gemini"): AiError {
  if (err instanceof AiError) return err;
  return new AiError(friendlyAiErrorMessage(err, provider), sanitizeAiErrorDetail(err));
}

/** Turn a raw provider / network failure into a message a shopkeeper can act on. */
export function friendlyAiErrorMessage(err: unknown, provider: AiProvider = "gemini"): string {
  const name = provider === "gemini" ? "Gemini" : provider === "openai" ? "OpenAI" : "Claude";
  // Already friendly (thrown by our own code): pass it through unchanged
  // instead of re-mapping it into the generic message.
  if (err instanceof AiError) return err.message;
  const e = err as { status?: number; code?: string; message?: string } | null;
  const text = `${e?.status ?? ""} ${e?.code ?? ""} ${e?.message ?? ""}`;
  if (/Gemini is busy|key was rejected|Could not reach|AI parsing failed|AI output|did not return (valid JSON|a ledger entry)|is not available for this|Voice notes are transcribed|doesn't look like a|is overloaded|try again in a moment/i.test(text)) {
    return e?.message ?? "AI parsing failed — please try again.";
  }
  if (isModelNotFoundError(err)) {
    return `That AI model is not available for this ${name} key — pick another model in Settings (the default works with most keys).`;
  }
  if (/429|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(text)) {
    return `${name} is busy right now (rate limit) — wait a minute and try again.`;
  }
  if (/503|502|504|500|UNAVAILABLE|overloaded|overloaded with requests|try again later/i.test(text)) {
    return `${name} is overloaded right now — try again in a moment.`;
  }
  if (/400|401|403|API_KEY_INVALID|PERMISSION_DENIED|UNAUTHENTICATED|invalid (api )?key|invalid x-api-key|authentication_error/i.test(text)) {
    return `That ${name} API key was rejected — check the key in Settings (your own key, or ask the Admin to restore the host key).`;
  }
  if (/fetch failed|network|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(text)) {
    return `Could not reach ${name} — check your internet connection and try again.`;
  }
  return "AI parsing failed — please try again.";
}

/** Parse + repair one JSON string from any provider. */
function parseAndRepair(text: string, providerName: string): ParsedLedgerResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    // Specific, not generic: the model answered but not in JSON.
    throw new AiError(`${providerName} did not return valid JSON.`, `${providerName} did not return valid JSON.`);
  }
  const repaired = repairParsedLedgerResult(parsed);
  // A validation failure is already a specific message — keep it as both
  // the message and the detail, so the route never re-maps it to generic.
  if (!repaired.ok || !repaired.result) throw new AiError(repaired.error ?? `${providerName} output failed validation.`, repaired.error ?? `${providerName} output failed validation.`);
  return repaired.result;
}

/** One Gemini generateContent call with the ledger schema. Returns the raw text. */
async function generateLedgerGemini(input: string, apiKey: string, model: string, budget: ThinkingBudget): Promise<string> {
  const ai = getGeminiClient(apiKey);
  const res = await ai.models.generateContent({
    model,
    contents: `Input: ${input}`,
    config: {
      systemInstruction: LEDGER_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: LEDGER_RESPONSE_SCHEMA,
      ...thinkingConfigFor(model, budget),
    },
  });
  return res.text ?? "";
}

export async function parseLedgerWithAi(input: string, opts: ParseLedgerOptions): Promise<ParsedLedgerResult> {
  const model = opts.model && ALLOWED_MODELS.includes(opts.model) ? opts.model : GEMINI_MODEL;
  const budget = opts.thinkingBudget ?? "standard";
  let text: string;
  try {
    // Sent directly to the configured model — never silently re-routed to
    // another model. If this model is not available for the key, the error
    // says so plainly (friendlyAiErrorMessage maps 404 to "model not
    // available") instead of the request landing on a different model.
    text = await generateLedgerGemini(input, opts.apiKey, model, budget);
  } catch (err) {
    throw aiErrorFrom(err, "gemini");
  }
  return parseAndRepair(text, "Gemini");
}

export interface ProviderParseResult {
  result: ParsedLedgerResult;
  provider: AiProvider;
  modelUsed: AiModel;
}

export interface ProviderParseOptions {
  apiKey: string;
  provider: AiProvider;
  model?: AiModel;
  thinkingBudget?: ThinkingBudget;
}

/** The single entry point for text parsing: detect the provider once, dispatch, and report which model actually ran. */
export async function parseLedgerWithProvider(input: string, opts: ProviderParseOptions): Promise<ProviderParseResult> {
  const model = modelForProvider(opts.provider, opts.model);
  if (opts.provider === "openai") {
    try {
      return { result: await parseLedgerWithOpenAi(input, { apiKey: opts.apiKey, model }), provider: "openai", modelUsed: model };
    } catch (err) {
      throw aiErrorFrom(err, "openai");
    }
  }
  if (opts.provider === "claude") {
    try {
      return { result: await parseLedgerWithClaude(input, { apiKey: opts.apiKey, model }), provider: "claude", modelUsed: model };
    } catch (err) {
      throw aiErrorFrom(err, "claude");
    }
  }
  const result = await parseLedgerWithAi(input, { apiKey: opts.apiKey, model, thinkingBudget: opts.thinkingBudget });
  return { result, provider: "gemini", modelUsed: model };
}

/** Cheap liveness probe used by the Settings "Test" button. Returns the provider's reply (e.g. "OK"). */
export async function pingProvider(opts: ProviderParseOptions): Promise<string> {
  const model = modelForProvider(opts.provider, opts.model);
  if (opts.provider === "openai") return pingOpenAi({ apiKey: opts.apiKey, model });
  if (opts.provider === "claude") return pingClaude({ apiKey: opts.apiKey, model });
  const ai = getGeminiClient(opts.apiKey);
  const res = await ai.models.generateContent({
    model,
    contents: "Reply with the single word OK.",
    config: { maxOutputTokens: 5, ...thinkingConfigFor(model, opts.thinkingBudget ?? "standard") },
  });
  return (res.text ?? "").trim();
}

/**
 * Gemini parses the voice note itself - transcribe + parse in one call,
 * so Pashto and Urdu speech that the browser's speech recognition
 * mangles still becomes a clean structured entry. Audio is sent to
 * Gemini for this request only and is never stored server-side.
 * The mimeType is normalised here (Chrome sends "audio/webm;codecs=opus").
 */
export async function parseVoiceNoteWithAi(
  audioBase64: string,
  mimeType: string,
  opts: ParseLedgerOptions,
): Promise<ParsedLedgerResult> {
  const model = opts.model && ALLOWED_MODELS.includes(opts.model) ? opts.model : GEMINI_MODEL;
  const budget = opts.thinkingBudget ?? "standard";
  const baseMime = mimeType.split(";")[0].trim();
  const ai = getGeminiClient(opts.apiKey);
  let res;
  try {
    res = await ai.models.generateContent({
      model,
      contents: [
        { inlineData: { mimeType: baseMime, data: audioBase64 } },
        { text: "Transcribe this voice note from a Pakistani shopkeeper (Urdu, Pashto, Roman Urdu, or English), then parse it as a ledger entry using the system instructions." },
      ],
      config: {
        systemInstruction: LEDGER_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: LEDGER_RESPONSE_SCHEMA,
        ...thinkingConfigFor(model, budget),
      },
    });
  } catch (err) {
    // Direct to the configured model only — no silent re-route to another
    // model on 404; the error names the model problem instead.
    throw aiErrorFrom(err, "gemini");
  }
  const text = res.text ?? "";
  return parseAndRepair(text, "Gemini");
}

export async function parseVoiceNoteWithProvider(
  audioBase64: string,
  mimeType: string,
  opts: ProviderParseOptions,
): Promise<ProviderParseResult> {
  if (opts.provider !== "gemini") {
    throw new Error(
      "Voice notes are transcribed by Gemini — with an OpenAI or Claude key, use live speech (Speak entry) instead, which types the entry for the same AI to parse.",
    );
  }
  const model = modelForProvider("gemini", opts.model);
  const result = await parseVoiceNoteWithAi(audioBase64, mimeType, { apiKey: opts.apiKey, model, thinkingBudget: opts.thinkingBudget });
  return { result, provider: "gemini", modelUsed: model };
}

export async function generateReminderDraft(
  customerName: string,
  balance: number,
  language: "en" | "ur" = "en",
  opts: ParseLedgerOptions & { provider?: AiProvider },
): Promise<string> {
  const provider = opts.provider ?? "gemini";
  const { result } = await parseLedgerWithProvider(
    `Remind ${customerName} to pay ${balance} PKR udhaar. Language: ${language}.`,
    { apiKey: opts.apiKey, provider, model: opts.model, thinkingBudget: opts.thinkingBudget },
  );
  return result.whatsapp_reminder_draft || `Assalam-o-Alaikum ${customerName}, aap ka ${balance} PKR udhaar baqi hai. — KhattaSync`;
}

/** Legacy wrapper (Prompt 1 route) — maps the strict result to the old ParsedLedgerInput shape. */
export async function parseLedgerText(input: string, apiKey?: string): Promise<import("../../types").ParsedLedgerInput> {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");
  const result = await parseLedgerWithAi(input, { apiKey: key });
  return {
    customerName: result.customer_name,
    type: result.credit_balance_change >= 0 ? "gave" : "got",
    amount: result.total_amount,
    note: result.items.map((i) => i.name).join(", ") || undefined,
    confidence: result.is_valid_ledger_entry ? 1 : 0,
  };
}

export { DEFAULT_MODEL };
