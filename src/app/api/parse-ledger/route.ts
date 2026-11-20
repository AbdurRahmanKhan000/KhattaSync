import { NextRequest, NextResponse } from "next/server";
import { containsPromptInjection, isLedgerQuery, isOffTopic, rejectedResult } from "@/lib/security";
import {
  friendlyAiErrorMessage,
  generateReminderDraft,
  parseLedgerWithProvider,
  parseVoiceNoteWithProvider,
  pingProvider,
  resolveAiKey,
  sanitizeAiErrorDetail,
} from "@/lib/ai";
import { PROVIDER_LABELS, modelForProvider, providerSupportsVoiceAudio, type AiProvider } from "@/lib/ai/providers";
import { ERROR_MESSAGES } from "@/constants";
import type { ThinkingBudget } from "@/types";

/**
 * POST /api/parse-ledger — the ONLY AI entry point. Structured ledger engine, NOT a chatbot.
 * Body: { input, action?: "parse" | "reminder" | "voice" | "ping", apiKey?: string (BYOK, per-request only),
 *         hostKeyAllowed?: boolean, model?: string, thinkingBudget?: ThinkingBudget,
 *         customerName?: string, balance?: number, language?: "en" | "ur",
 *         audio?: string (base64 voice note, action "voice"), mimeType?: string }
 * One key bar accepts a Gemini (AIza…), OpenAI (sk-…), or Claude (sk-ant-…) key;
 * the provider is detected from the key itself, server-side. The server
 * GEMINI_API_KEY is never sent to the browser. The user key, if supplied, is
 * used for this request only and never stored server-side. Audio is sent to
 * Gemini for transcription + parsing in that request only and is never stored.
 * Failures return a friendly message AND a `detail` string with the
 * provider's own error text — a failure must never again hide its real cause.
 */
export async function POST(req: NextRequest) {
  let providerForError: AiProvider | null = null;
  try {
    const body = (await req.json()) as {
      input?: unknown; action?: unknown; apiKey?: unknown; hostKeyAllowed?: unknown;
      model?: unknown; thinkingBudget?: unknown; customerName?: unknown; balance?: unknown; language?: unknown;
      audio?: unknown; mimeType?: unknown;
    };
    const action =
      body.action === "reminder" ? "reminder"
      : body.action === "voice" ? "voice"
      : body.action === "ping" ? "ping"
      : "parse";
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (action !== "voice" && action !== "ping" && !input) {
      return NextResponse.json({ ok: false, error: ERROR_MESSAGES.missingCustomer, parsed: rejectedResult(ERROR_MESSAGES.missingCustomer) });
    }

    // Gate 1 + 2: injection and domain, before any AI call.
    // (Voice notes have no input text — their content is judged by the
    // model + server validation in the voice branch below.)
    if (action !== "voice" && action !== "ping" && containsPromptInjection(input)) {
      return NextResponse.json({ ok: false, error: ERROR_MESSAGES.ledgerOnly, parsed: rejectedResult(ERROR_MESSAGES.ledgerOnly) });
    }
    if (action !== "voice" && action !== "ping" && isOffTopic(input)) {
      return NextResponse.json({ ok: false, error: ERROR_MESSAGES.ledgerOnly, parsed: rejectedResult(ERROR_MESSAGES.ledgerOnly) });
    }

    // Balance questions are answered from the local ledger in the app —
    // no AI call is needed, so never send one to any provider.
    if (action !== "voice" && action !== "ping" && isLedgerQuery(input)) {
      const message = "That's a question about your ledger — the app answers it instantly from your local khata, no AI call needed.";
      return NextResponse.json({ ok: false, error: message, parsed: rejectedResult(message) });
    }

    // Key resolution: BYOK wins; host key only if the Admin has not withdrawn it.
    const hostKeyAllowed = body.hostKeyAllowed !== false;
    const resolved = resolveAiKey({
      hostKeyAllowed,
      userApiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      serverKey: process.env.GEMINI_API_KEY,
    });
    if (!resolved.apiKey) {
      const message = hostKeyAllowed ? ERROR_MESSAGES.noAiKey : ERROR_MESSAGES.hostKeyWithdrawn;
      return NextResponse.json({ ok: false, error: message, keyMode: "none", parsed: rejectedResult(message) });
    }
    if (!resolved.provider) {
      const message = "That key doesn't look like a Gemini, OpenAI, or Claude key — paste the full key from your provider's dashboard (Gemini keys start with AIza or AQ., OpenAI with sk-, Claude with sk-ant-).";
      return NextResponse.json({ ok: false, error: message, keyMode: resolved.mode, parsed: rejectedResult(message) });
    }
    providerForError = resolved.provider;
    const provider = resolved.provider;

    const model = modelForProvider(provider, typeof body.model === "string" ? body.model : undefined);
    const thinkingBudget: ThinkingBudget = body.thinkingBudget === "low" || body.thinkingBudget === "high" ? (body.thinkingBudget as ThinkingBudget) : "standard";
    const opts = { apiKey: resolved.apiKey, provider, model, thinkingBudget };

    if (action === "ping") {
      try {
        const reply = await pingProvider(opts);
        return NextResponse.json({
          ok: true,
          keyMode: resolved.mode,
          provider,
          providerLabel: PROVIDER_LABELS[provider],
          model,
          reply,
        });
      } catch (err) {
        return NextResponse.json({
          ok: false,
          error: friendlyAiErrorMessage(err, provider),
          detail: sanitizeAiErrorDetail(err),
          keyMode: resolved.mode,
          provider,
          model,
        });
      }
    }

    if (action === "voice") {
      if (!providerSupportsVoiceAudio(provider)) {
        const message = `Voice notes are transcribed by Gemini — with a ${PROVIDER_LABELS[provider]} key, use live speech (Speak entry) instead, which types the entry for the same AI to parse.`;
        return NextResponse.json({ ok: false, error: message, keyMode: resolved.mode, provider, model, parsed: rejectedResult(message) });
      }
      // Voice note: Gemini transcribes the audio and parses it in one call.
      // No text gates apply here — the audio content is judged by the
      // model + server validation, same as typed text.
      // Chrome sends "audio/webm;codecs=opus" — check the base type only.
      const audio = typeof body.audio === "string" ? body.audio : "";
      const mimeType = typeof body.mimeType === "string" ? body.mimeType.split(";")[0].trim() : "";
      const allowedAudio = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-wav"];
      if (!audio || audio.length > 7_000_000 || !allowedAudio.includes(mimeType)) {
        const message = "That voice note could not be read — please record it again.";
        return NextResponse.json({ ok: false, error: message, keyMode: resolved.mode, provider, model, parsed: rejectedResult(message) });
      }
      const { result: voiceParsed, modelUsed } = await parseVoiceNoteWithProvider(audio, mimeType, opts);
      if (!voiceParsed.is_valid_ledger_entry) {
        return NextResponse.json({ ok: false, error: voiceParsed.rejection_reason || ERROR_MESSAGES.ledgerOnly, keyMode: resolved.mode, provider, model: modelUsed, parsed: voiceParsed });
      }
      return NextResponse.json({ ok: true, keyMode: resolved.mode, provider, model: modelUsed, parsed: voiceParsed });
    }

    if (action === "reminder") {
      const name = typeof body.customerName === "string" && body.customerName ? body.customerName : input;
      const balance = typeof body.balance === "number" ? body.balance : 0;
      const draft = await generateReminderDraft(name, balance, body.language === "ur" ? "ur" : "en", opts);
      return NextResponse.json({ ok: true, keyMode: resolved.mode, provider, model, whatsapp_reminder_draft: draft });
    }

    // Gate 3 happens inside parseLedgerWithProvider (schema + server repair + validation).
    const { result: parsed, modelUsed } = await parseLedgerWithProvider(input, opts);
    if (!parsed.is_valid_ledger_entry) {
      return NextResponse.json({ ok: false, error: parsed.rejection_reason || ERROR_MESSAGES.ledgerOnly, keyMode: resolved.mode, provider, model: modelUsed, parsed });
    }
    return NextResponse.json({ ok: true, keyMode: resolved.mode, provider, model: modelUsed, parsed });
  } catch (err) {
    // Expected AI failures (rate limit, rejected key, network) are app
    // outcomes, not transport failures — return 200 + ok:false so the
    // browser console stays clean. Truly unexpected errors still surface
    // the friendly message, never a stack trace. `detail` carries the
    // provider's own error text so the real cause is visible.
    const provider = providerForError ?? "gemini";
    const message = err instanceof Error ? friendlyAiErrorMessage(err, provider) : ERROR_MESSAGES.generic;
    const detail = err instanceof Error ? sanitizeAiErrorDetail(err) : undefined;
    return NextResponse.json({ ok: false, error: message, detail, provider, parsed: rejectedResult(message) });
  }
}
