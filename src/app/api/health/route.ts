import { NextResponse } from "next/server";
export async function GET() {
  // Boolean only — the key itself is never exposed to the browser.
  return NextResponse.json({ ok: true, service: "khattasync", aiKeyConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()) });
}
