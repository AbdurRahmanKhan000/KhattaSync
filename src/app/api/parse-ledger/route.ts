import { NextRequest, NextResponse } from "next/server";
import { containsPromptInjection, isLedgerQuery, isOffTopic, rejectedResult } from "@/lib/security";
import { ALLOWED_MODELS, friendlyAiErrorMessage, generateReminderDraft, parseLedgerWithAi, parseVoiceNoteWithAi, resolveAiKey, type ParseLedgerOptions } from "@/lib/ai";
import { ERROR_MESSAGES } from "@/constants";
import type { AiModel, ThinkingBudget } from "@/types";

/**
 * POST /api/parse-ledger — the ONLY AI entry point. Structured ledger engine, NOT a chatbot.
 * Body: { input, action?: "parse" | "reminder" | "voice", apiKey?: string (BYOK, per-request only),
 *         hostKeyAllowed?: boolean, model?: AiModel, thinkingBudget?: ThinkingBudget,
 *         customerName?: string, balance?: number, language?: "en" | "ur",
 *         audio?: string (base64 voice note, action "voice"), mimeType?: string }
 * The server GEMINI_API_KEY is never sent to the browser. The user key, if
 * supplied, is used for this request only and never stored server-side.
 * Audio is sent to Gemini for transcription + parsing in that request
 * only and is never stored server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      input?: unknown; action?: unknown; apiKey?: unknown; hostKeyAllowed?: unknown;
      model?: unknown; thinkingBudget?: unknown; customerName?: unknown; balance?: unknown; language?: unknown;
      audio?: unknown; mimeType?: unknown;
    };
    const action = body.action === "reminder" ? "reminder" : body.action === "voice" ? "voice" : "parse";
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (action !== "voice" && !input) return NextResponse.json({ ok: false, error: ERROR_MESSAGES.missingCustomer, parsed: rejectedResult(ERROR_MESSAGES.missingCustomer) });

    // Gate 1 + 2: injection and domain, before any Gemini call.
    // (Voice notes have no input text — their content is judged by the
    // model + server validation in the voice branch below.)
    if (action !== "voice" && containsPromptInjection(input)) {
      return NextResponse.json({ ok: false, error: ERROR_MESSAGES.ledgerOnly, parsed: rejectedResult(ERROR_MESSAGES.ledgerOnly) });
    }
    if (action !== "voice" && isOffTopic(input)) {
      return NextResponse.json({ ok: false, error: ERROR_MESSAGES.ledgerOnly, parsed: rejectedResult(ERROR_MESSAGES.ledgerOnly) });
    }

    // Balance questions are answered from the local ledger in the app —
    // no AI call is needed, so never send one to Gemini.
    if (action !== "voice" && isLedgerQuery(input)) {
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

    const model: AiModel = typeof body.model === "string" && (ALLOWED_MODELS as string[]).includes(body.model) ? (body.model as AiModel) : "gemini-3.8-flash";
    const thinkingBudget: ThinkingBudget = body.thinkingBudget === "low" || body.thinkingBudget === "high" ? (body.thinkingBudget as ThinkingBudget) : "standard";
    const opts: ParseLedgerOptions = { apiKey: resolved.apiKey, model, thinkingBudget };

    if (action === "voice") {
      // Voice note: Gemini transcribes the audio and parses it in one call.
      // No text gates apply here — the audio content is judged by the
      // model + server validation, same as typed text.
      const audio = typeof body.audio === "string" ? body.audio : "";
      const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
      const allowedAudio = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-wav"];
      if (!audio || audio.length > 7_000_000 || !allowedAudio.includes(mimeType)) {
        const message = "That voice note could not be read — please record it again.";
        return NextResponse.json({ ok: false, error: message, parsed: rejectedResult(message) });
      }
      const voiceParsed = await parseVoiceNoteWithAi(audio, mimeType, opts);
      if (!voiceParsed.is_valid_ledger_entry) {
        return NextResponse.json({ ok: false, error: voiceParsed.rejection_reason || ERROR_MESSAGES.ledgerOnly, keyMode: resolved.mode, model, parsed: voiceParsed });
      }
      return NextResponse.json({ ok: true, keyMode: resolved.mode, model, parsed: voiceParsed });
    }

    if (action === "reminder") {
      const name = typeof body.customerName === "string" && body.customerName ? body.customerName : input;
      const balance = typeof body.balance === "number" ? body.balance : 0;
      const draft = await generateReminderDraft(name, balance, body.language === "ur" ? "ur" : "en", opts);
      return NextResponse.json({ ok: true, keyMode: resolved.mode, model, whatsapp_reminder_draft: draft });
    }

    // Gate 3 happens inside parseLedgerWithAi (responseSchema + server validation).
    const parsed = await parseLedgerWithAi(input, opts);
    if (!parsed.is_valid_ledger_entry) {
      return NextResponse.json({ ok: false, error: parsed.rejection_reason || ERROR_MESSAGES.ledgerOnly, keyMode: resolved.mode, model, parsed });
    }
    return NextResponse.json({ ok: true, keyMode: resolved.mode, model, parsed });
  } catch (err) {
    // Expected AI failures (rate limit, rejected key, network) are app
    // outcomes, not transport failures — return 200 + ok:false so the
    // browser console stays clean. Truly unexpected errors still surface
    // the friendly message, never a stack trace.
    const message = err instanceof Error ? friendlyAiErrorMessage(err) : ERROR_MESSAGES.generic;
    return NextResponse.json({ ok: false, error: message, parsed: rejectedResult(message) });
  }
}
