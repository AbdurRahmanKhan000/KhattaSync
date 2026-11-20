import { NextRequest, NextResponse } from "next/server";
import { containsPromptInjection, isOffTopic } from "@/lib/security";
import { parseLedgerWithAi, resolveAiKey } from "@/lib/ai";
import { ERROR_MESSAGES } from "@/constants";

/** Legacy route (Prompt 1) — now delegates to the strict Prompt 3 parser. Prefer /api/parse-ledger. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { input?: unknown; apiKey?: string };
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (!input) return NextResponse.json({ error: ERROR_MESSAGES.missingCustomer }, { status: 400 });
    if (containsPromptInjection(input)) return NextResponse.json({ error: ERROR_MESSAGES.injectionBlocked }, { status: 400 });
    if (isOffTopic(input)) return NextResponse.json({ error: ERROR_MESSAGES.offTopic }, { status: 400 });
    const resolved = resolveAiKey({ hostKeyAllowed: true, userApiKey: typeof body.apiKey === "string" ? body.apiKey : undefined, serverKey: process.env.GEMINI_API_KEY });
    if (!resolved.apiKey) return NextResponse.json({ error: ERROR_MESSAGES.noAiKey }, { status: 400 });
    const parsed = await parseLedgerWithAi(input, { apiKey: resolved.apiKey });
    return NextResponse.json({ ok: true, parsed, keyMode: resolved.mode });
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.generic;
    const status = message.includes("GEMINI_API_KEY") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
