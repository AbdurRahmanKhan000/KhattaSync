import { NextRequest, NextResponse } from "next/server";
import { containsPromptInjection, isOffTopic, rejectedResult } from "@/lib/security";
import { ALLOWED_MODELS, generateReminderDraft, parseLedgerWithAi, resolveAiKey, type ParseLedgerOptions } from "@/lib/ai";
import { ERROR_MESSAGES } from "@/constants";
import type { AiModel, ThinkingBudget } from "@/types";

/**
 * POST /api/parse-ledger — the ONLY AI entry point. Structured ledger engine, NOT a chatbot.
 * Body: { input, action?: "parse" | "reminder", apiKey?: string (BYOK, per-request only),
 *         hostKeyAllowed?: boolean, model?: AiModel, thinkingBudget?: ThinkingBudget,
 *         customerName?: string, balance?: number, language?: "en" | "ur" }
 * The server GEMINI_API_KEY is never sent to the browser. The user key, if
 * supplied, is used for this request only and never stored server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      input?: unknown; action?: unknown; apiKey?: unknown; hostKeyAllowed?: unknown;
      model?: unknown; thinkingBudget?: unknown; customerName?: unknown; balance?: unknown; language?: unknown;
    };
    const action = body.action === "reminder" ? "reminder" : "parse";
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (!input) return NextResponse.json({ ok: false, error: ERROR_MESSAGES.missingCustomer, parsed: rejectedResult(ERROR_MESSAGES.missingCustomer) }, { status: 400 });

    // Gate 1 + 2: injection and domain, before any Gemini call.
    if (containsPromptInjection(input)) {
      return NextResponse.json({ ok: false, error: ERROR_MESSAGES.ledgerOnly, parsed: rejectedResult(ERROR_MESSAGES.ledgerOnly) }, { status: 400 });
    }
    if (isOffTopic(input)) {
      return NextResponse.json({ ok: false, error: ERROR_MESSAGES.ledgerOnly, parsed: rejectedResult(ERROR_MESSAGES.ledgerOnly) }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: message, keyMode: "none", parsed: rejectedResult(message) }, { status: 400 });
    }

    const model: AiModel = typeof body.model === "string" && (ALLOWED_MODELS as string[]).includes(body.model) ? (body.model as AiModel) : "gemini-3.8-flash";
    const thinkingBudget: ThinkingBudget = body.thinkingBudget === "low" || body.thinkingBudget === "high" ? (body.thinkingBudget as ThinkingBudget) : "standard";
    const opts: ParseLedgerOptions = { apiKey: resolved.apiKey, model, thinkingBudget };

    if (action === "reminder") {
      const name = typeof body.customerName === "string" && body.customerName ? body.customerName : input;
      const balance = typeof body.balance === "number" ? body.balance : 0;
      const draft = await generateReminderDraft(name, balance, body.language === "ur" ? "ur" : "en", opts);
      return NextResponse.json({ ok: true, keyMode: resolved.mode, model, whatsapp_reminder_draft: draft });
    }

    // Gate 3 happens inside parseLedgerWithAi (responseSchema + server validation).
    const parsed = await parseLedgerWithAi(input, opts);
    if (!parsed.is_valid_ledger_entry) {
      return NextResponse.json({ ok: false, error: parsed.rejection_reason || ERROR_MESSAGES.ledgerOnly, keyMode: resolved.mode, model, parsed }, { status: 400 });
    }
    return NextResponse.json({ ok: true, keyMode: resolved.mode, model, parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.generic;
    return NextResponse.json({ ok: false, error: message, parsed: rejectedResult(message) }, { status: 500 });
  }
}
