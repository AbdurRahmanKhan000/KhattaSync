import type { CustomerAccount } from "../types";
import { formatPKR } from "./utils";

export interface LedgerQueryContext {
  customers: CustomerAccount[];
  totalUdhaar: number;
  collectedToday: number;
}

/**
 * Answer balance questions from the LOCAL ledger — no Gemini call, no
 * waiting, no key needed. Shopkeepers in a hurry ask "what is the total
 * credit of bibi Zainab" and expect the number the app already knows.
 * Returns the answer string, or null when the input is not a ledger
 * question (then it is a normal entry for the AI to parse).
 */
export function answerLedgerQuery(input: string, ctx: LedgerQueryContext): string | null {
  const lower = input.toLowerCase().trim();
  const isQuestion = /^(what|how|kitna|kitne|kya|kis|who|show|tell)\b/.test(lower)
    || /how much|kitna|total|balance|who owes/.test(lower);
  if (!isQuestion) return null;

  // A named customer wins over whole-shop totals: "total credit of
  // bibi Zainab" is about her, not the whole shop.
  const named = ctx.customers
    .filter((c) => lower.includes(c.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (named) {
    if (named.balance > 0) return `${named.name} owes ${formatPKR(named.balance)} (to collect).`;
    if (named.balance < 0) return `You owe ${named.name} ${formatPKR(Math.abs(named.balance))}.`;
    return `${named.name} is settled — Rs 0 balance.`;
  }

  // Whole-ledger totals.
  if (/(total|kul).*(udhaar|credit|due|lena)/.test(lower) || lower.includes("total udhaar")) {
    const n = ctx.customers.filter((c) => c.balance > 0).length;
    return `Total udhaar: ${formatPKR(ctx.totalUdhaar)} across ${n} customer${n === 1 ? " who still owes" : "s who still owe"}.`;
  }
  if (/collected today|aaj.*(collect|jama|mila)/.test(lower)) {
    return `Collected today: ${formatPKR(ctx.collectedToday)}.`;
  }
  if (/how many customers|kitne.*customer/.test(lower)) {
    return `${ctx.customers.length} customers in this khata.`;
  }
  if (/who owes/.test(lower)) {
    const owing = [...ctx.customers].filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance);
    if (owing.length === 0) return "Nobody owes anything right now — all settled.";
    return `Most owed by ${owing[0].name}: ${formatPKR(owing[0].balance)} of ${formatPKR(ctx.totalUdhaar)} total udhaar.`;
  }

  // A balance question with no matching customer: say so helpfully.
  if (/(credit|udhaar|balance|owe|baqi|baki|dena|lena|total)/.test(lower)) {
    return "I couldn't find that customer in this browser's khata — check the spelling, or add them with the + New Customer button.";
  }
  return null;
}
