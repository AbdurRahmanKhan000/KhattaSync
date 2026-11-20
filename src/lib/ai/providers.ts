import type { AiModel } from "../../types";

/**
 * Multi-provider AI for KhattaSync.
 *
 * One BYOK bar accepts a Gemini, OpenAI, or Claude key. The provider is
 * detected from the key itself — never trusted from the client — so a
 * shopkeeper pastes whichever key they have and it just works.
 *
 * Key shapes (public prefixes, no secret material):
 *   Gemini  "AIza..." or "AQ...." (since May 28, 2026 Google AI Studio
 *           issues auth keys starting with "AQ." — plain API keys on the
 *           same x-goog-api-key header, not OAuth) -> gemini
 *   OpenAI  "sk-..." / "sk-proj-..." -> openai
 *   Claude  "sk-ant-..."     -> claude
 */
export type AiProvider = "gemini" | "openai" | "claude";

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  claude: "Claude",
};

export function detectProvider(apiKey: string): AiProvider | null {
  const k = apiKey.trim();
  // Gemini: legacy AIza keys and the current AQ. auth keys (e.g. AQ.Ab8...).
  // The AQ. form is accepted with or without the dot, in case a paste drops it.
  if (k.startsWith("AIza") || k.startsWith("AQ.") || /^AQ[A-Za-z0-9\-_]{10,}$/.test(k)) return "gemini";
  if (k.startsWith("sk-ant-")) return "claude";
  if (k.startsWith("sk-proj-") || k.startsWith("sk-")) return "openai";
  return null;
}

/** Models offered per provider. Defaults are the cheapest fast model that can do strict JSON. */
export const PROVIDER_MODELS: Record<AiProvider, AiModel[]> = {
  gemini: ["gemini-3.8-flash", "gemini-3.5-flash-lite"],
  openai: ["gpt-4o-mini", "gpt-4o"],
  claude: ["claude-haiku-4-5", "claude-sonnet-5"],
};

export const PROVIDER_MODEL_LABELS: Record<AiModel, string> = {
  "gemini-3.8-flash": "Gemini 3.8 Flash (default)",
  "gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
  "gpt-4o-mini": "GPT-4o mini (default)",
  "gpt-4o": "GPT-4o",
  "claude-haiku-4-5": "Claude Haiku 4.5 (default)",
  "claude-sonnet-5": "Claude Sonnet 5",
};

export const DEFAULT_MODEL: Record<AiProvider, AiModel> = {
  gemini: "gemini-3.8-flash",
  openai: "gpt-4o-mini",
  claude: "claude-haiku-4-5",
};

/** Gemini fallback when the configured model is not available for this key/project. */
export const GEMINI_FALLBACK_MODEL: AiModel = "gemini-3.5-flash-lite";

/** Pick the model for a provider: the stored choice if it belongs to that provider, else the provider default. */
export function modelForProvider(provider: AiProvider, stored?: string): AiModel {
  const list = PROVIDER_MODELS[provider];
  if (stored && (list as string[]).includes(stored)) return stored as AiModel;
  return DEFAULT_MODEL[provider];
}

/** Only Gemini accepts raw audio in this app. OpenAI/Claude voice uses live speech transcription instead. */
export function providerSupportsVoiceAudio(provider: AiProvider): boolean {
  return provider === "gemini";
}
