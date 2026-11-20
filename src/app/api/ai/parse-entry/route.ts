import { NextRequest, NextResponse } from "next/server";
import { containsPromptInjection, isOffTopic } from "@/lib/security";
import { parseLedgerText } from "@/lib/ai";
import { ERROR_MESSAGES } from "@/constants";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { input?: unknown; apiKey?: string };
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (!input) return NextResponse.json({ error: ERROR_MESSAGES.missingCustomer }, { status: 400 });
    if (containsPromptInjection(input)) return NextResponse.json({ error: ERROR_MESSAGES.injectionBlocked }, { status: 400 });
    if (isOffTopic(input)) return NextResponse.json({ error: ERROR_MESSAGES.offTopic }, { status: 400 });
    const apiKey = typeof body.apiKey === "string" && body.apiKey ? body.apiKey : undefined;
    const parsed = await parseLedgerText(input, apiKey);
    return NextResponse.json({ ok: true, parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.generic;
    const status = message.includes("GEMINI_API_KEY") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
