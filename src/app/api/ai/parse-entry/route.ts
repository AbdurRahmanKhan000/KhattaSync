import { NextRequest, NextResponse } from "next/server";
import { containsPromptInjection, isOffTopic } from "@/lib/security";
import { friendlyAiErrorMessage, parseLedgerWithAi, resolveAiKey } from "@/lib/ai";
import { ERROR_MESSAGES } from "@/constants";

/** Legacy route (Prompt 1) — now delegates to the strict Prompt 3 parser. Prefer /api/parse-ledger. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { input?: unknown; apiKey?: string };
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (!input) return NextResponse.json({ ok: false, error: ERROR_MESSAGES.missingCustomer });
    if (containsPromptInjection(input)) return NextResponse.json({ ok: false, error: ERROR_MESSAGES.injectionBlocked });
    if (isOffTopic(input)) return NextResponse.json({ ok: false, error: ERROR_MESSAGES.offTopic });
    const resolved = resolveAiKey({ hostKeyAllowed: true, userApiKey: typeof body.apiKey === "string" ? body.apiKey : undefined, serverKey: process.env.GEMINI_API_KEY });
    if (!resolved.apiKey) return NextResponse.json({ ok: false, error: ERROR_MESSAGES.noAiKey });
    const parsed = await parseLedgerWithAi(input, { apiKey: resolved.apiKey });
    return NextResponse.json({ ok: true, parsed, keyMode: resolved.mode });
  } catch (err) {
    const message = err instanceof Error ? friendlyAiErrorMessage(err) : ERROR_MESSAGES.generic;
    return NextResponse.json({ ok: false, error: message });
  }
}
