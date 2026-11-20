import type { ParsedLedgerResult } from "../../types";
import { ERROR_MESSAGES } from "../../constants";

/**
 * KhattaSync is a structured ledger engine, NOT a chatbot.
 * Every AI request passes three gates before Gemini is called:
 *  1. prompt-injection filter,  2. domain (ledger-only) filter,
 *  3. strict output validation after Gemini returns.
 * No generic chat UI exists anywhere in the app.
 */

export const LEDGER_ONLY_MESSAGE = ERROR_MESSAGES.ledgerOnly;

/** SHA-256 hex of the default Admin Vault password (set by the owner in Prompt 3). Plaintext is never stored in code. */
export const DEFAULT_ADMIN_PASSWORD_HASH =
  "56eb40d3bd5fcb53c8ac9a4a9fbae7524bf8554fe65a5734cab9cf265a2a52af";

/** Web-Crypto SHA-256 — works in the browser AND in Node (no node:crypto import, so client components can use it). */
export async function hashAdminPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time-ish comparison against the stored SHA-256 hash. */
export async function verifyAdminPassword(password: string, storedHash: string): Promise<boolean> {
  const candidate = await hashAdminPassword(password);
  if (candidate.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ storedHash.charCodeAt(i);
  return diff === 0;
}

const INJECTION_PATTERNS = [
  /ignore (all |any |previous |prior )?(instructions|prompts|rules)/i,
  /you are (now|a|an)\b/i,
  /system prompt/i,
  /reveal (your|the) (prompt|instructions|system)/i,
  /jailbreak/i,
  /do not (follow|obey)/i,
  /pretend (you are|to be)/i,
  /disregard (all|any|previous|prior)/i,
  /as an ai language model/i,
];

/** True when the text looks like a prompt-injection attempt. */
export function containsPromptInjection(input: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(input));
}

const LEDGER_KEYWORDS = [
  // English verbs — every form a hurried shopkeeper uses, not just "gave".
  "udhaar", "khata", "gave", "give", "given", "got", "get", "took", "take",
  "paid", "pay", "payment", "due", "credit", "debit", "owe", "owes", "owed",
  "cash", "rupee", "rupees", "rs", "pkr", "amount", "sale", "sold",
  "purchase", "bought", "stock", "inventory", "remind", "reminder", "collect",
  "remaining", "balance",
  // Roman Urdu verbs — dena/lena/diya/liya are how shopkeepers actually speak.
  "diya", "liya", "dena", "lena", "dene", "lene", "baqi", "baki",
  "atta", "ghee", "cheeni", "sugar", "rice", "oil", "rashan", "daal", "chai",
  "flour", "bag", "bags",
  // Pashto: por = debt/credit owed, paisay = money, wakral = gave.
  "paisay", "paisa", "wakral", "پور", "پیسې", "باقي",
];

const OFF_TOPIC_KEYWORDS = [
  "essay", "joke", "recipe", "trivia", "homework", "code", "coding", "python",
  "javascript", "poem", "story", "movie", "song", "weather", "news", "football",
  "cricket score", "who won", "capital of", "translate this", "write a",
  "tell me about", "explain quantum", "how to hack",
  // Maths / schoolwork — previously slipped through because "Solve 2x+5=10"
  // has digits and a capitalised word, which looked ledger-like.
  "solve", "equation", "calculate", "algebra", "geometry", "integral",
  "derivative", "math problem", "physics", "chemistry",
];

/** True when the input is a question about the ledger itself
 * ("what is the total credit of bibi Zainab", "kitna udhaar hai").
 * Queries are answered locally from IndexedDB — they are never blocked
 * and never sent to Gemini. */
export function isLedgerQuery(input: string): boolean {
  const lower = input.toLowerCase().trim();
  const questionWords = ["what", "how", "kitna", "kitne", "kya", "kis", "who", "show", "tell"];
  const queryWords = ["total", "credit", "udhaar", "balance", "owe", "owes", "owed", "due", "baqi", "baki", "dena", "lena", "remaining", "collected", "kitna", "por", "paisay"];
  const startsQuestion = questionWords.some((w) => lower.startsWith(w + " "));
  const hasQueryWord = queryWords.some((k) => lower.includes(k));
  if (startsQuestion && hasQueryWord) return true;
  if (/(how much|kitna|kya).*(owe|udhaar|credit|balance|baqi|baki|dena|lena)/.test(lower)) return true;
  if (/(total|balance|credit|udhaar).*(of|hai|hain)/.test(lower)) return true;
  if (/who owes/.test(lower)) return true;
  return false;
}

/**
 * Ledger-only guardrail — permissive by design, because shopkeepers type
 * in a hurry, in lowercase, in Roman Urdu. The old version demanded a
 * ledger keyword OR a capitalised name, so real entries like
 * "took 200 from faizan", "dena hai 200" and "bibi zainab give me 200"
 * were blocked before Gemini ever saw them. Now:
 *  - clear off-topic / injection patterns are still blocked first;
 *  - ledger questions are recognised, not blocked;
 *  - anything with an amount is a money record — let Gemini + server
 *    validation judge whether it parses, with a helpful message if not;
 *  - only inputs with no amount, no ledger word and no question are blocked.
 */
export function isOffTopic(input: string): boolean {
  const lower = input.toLowerCase();
  if (OFF_TOPIC_KEYWORDS.some((k) => lower.includes(k))) return true;
  // An equation ("2x+5=10") with no ledger keyword is schoolwork, not a khata entry.
  if (lower.includes("=") && !LEDGER_KEYWORDS.some((k) => lower.includes(k))) return true;
  if (isLedgerQuery(input)) return false;
  const hasAmount = /\d/.test(input);
  if (hasAmount) return false;
  const hasKeyword = LEDGER_KEYWORDS.some((k) => lower.includes(k))
    // "por" (Pashto: debt) as a whole word only - "report"/"support"
    // contain it but are not ledger words.
    || /\bpor\b/.test(lower);
  return !hasKeyword;
}

export function isLedgerDomain(input: string): boolean {
  return !containsPromptInjection(input) && !isOffTopic(input);
}

const ACTION_TYPES = ["sale", "purchase", "payment", "credit", "inventory_note", "reminder"] as const;

export interface ValidationResult {
  ok: boolean;
  result?: ParsedLedgerResult;
  error?: string;
}

/** Server-side output validation — Gemini's JSON is never trusted unchecked. */
export function validateParsedLedgerResult(data: unknown): ValidationResult {
  if (!data || typeof data !== "object") return { ok: false, error: "AI returned no JSON object." };
  const d = data as Partial<ParsedLedgerResult>;
  if (typeof d.action_type !== "string" || !ACTION_TYPES.includes(d.action_type as (typeof ACTION_TYPES)[number])) {
    return { ok: false, error: "Invalid action_type in AI output." };
  }
  if (typeof d.customer_name !== "string" || d.customer_name.trim().length === 0) {
    return { ok: false, error: "AI output is missing a customer name." };
  }
  if (!Array.isArray(d.items)) return { ok: false, error: "AI output items must be an array." };
  for (const item of d.items) {
    if (!item || typeof item.name !== "string" || typeof item.amount !== "number" || !Number.isFinite(item.amount) || item.amount < 0) {
      return { ok: false, error: "AI output has an invalid item." };
    }
  }
  const nums = [d.total_amount, d.amount_paid, d.credit_balance_change];
  if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n) || (n as number) < 0 && d.action_type !== "payment")) {
    return { ok: false, error: "AI output amounts must be finite numbers." };
  }
  if (typeof d.total_amount !== "number" || typeof d.amount_paid !== "number" || typeof d.credit_balance_change !== "number") {
    return { ok: false, error: "AI output is missing amounts." };
  }
  if (d.currency !== "PKR") return { ok: false, error: "Currency must be PKR." };
  if (typeof d.is_valid_ledger_entry !== "boolean") return { ok: false, error: "AI output is missing is_valid_ledger_entry." };
  if (typeof d.whatsapp_reminder_draft !== "string" || typeof d.rejection_reason !== "string") {
    return { ok: false, error: "AI output is missing reminder / rejection fields." };
  }
  // Internal consistency: items must add up to the total (within Rs 1).
  const itemsSum = d.items.reduce((s, i) => s + i.amount, 0);
  if (d.items.length > 0 && Math.abs(itemsSum - d.total_amount) > 1) {
    return { ok: false, error: "AI output items do not add up to total_amount." };
  }
  if (d.action_type === "sale" || d.action_type === "credit") {
    if (Math.abs(d.credit_balance_change - (d.total_amount - d.amount_paid)) > 1) {
      return { ok: false, error: "AI output credit_balance_change does not match total - paid." };
    }
  }
  if (d.action_type === "payment") {
    if (d.total_amount !== d.amount_paid || d.credit_balance_change !== -d.amount_paid) {
      return { ok: false, error: "For a payment, total_amount must equal amount_paid and credit change must be negative." };
    }
  }
  return { ok: true, result: d as ParsedLedgerResult };
}

/**
 * Repair, don't reject: a shopkeeper in a hurry loses the whole entry when
 * the model gets a derived number slightly wrong (the failure behind
 * "AI parsing failed" on live). Structural problems (missing customer,
 * bad action, bad item, non-PKR) still reject with a specific error.
 * Arithmetic the model can get wrong is recomputed deterministically:
 *   - payment: total = paid, change = -paid
 *   - sale/credit: change = total - paid; if paid > total, total = paid, change = 0
 *   - items: if they add up to something else and that sum is usable
 *     (positive, and paid fits inside it), the itemised sum is the total;
 *     otherwise the total stands and the items stay as a display breakdown.
 * The ledger balance only ever uses total / paid / change, so a repaired
 * entry can never corrupt a balance — it just saves instead of failing.
 */
export function repairParsedLedgerResult(data: unknown): ValidationResult {
  if (!data || typeof data !== "object") return { ok: false, error: "AI returned no JSON object." };
  const d = data as Partial<ParsedLedgerResult>;
  if (typeof d.action_type !== "string" || !ACTION_TYPES.includes(d.action_type as (typeof ACTION_TYPES)[number])) {
    return { ok: false, error: "Invalid action_type in AI output." };
  }
  if (typeof d.customer_name !== "string" || d.customer_name.trim().length === 0) {
    return { ok: false, error: "AI output is missing a customer name." };
  }
  if (!Array.isArray(d.items)) return { ok: false, error: "AI output items must be an array." };
  for (const item of d.items) {
    if (!item || typeof item.name !== "string" || typeof item.amount !== "number" || !Number.isFinite(item.amount) || item.amount < 0) {
      return { ok: false, error: "AI output has an invalid item." };
    }
  }
  const nums = [d.total_amount, d.amount_paid, d.credit_balance_change];
  if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
    return { ok: false, error: "AI output amounts must be finite numbers." };
  }
  if (d.currency !== "PKR") return { ok: false, error: "Currency must be PKR." };
  if (typeof d.is_valid_ledger_entry !== "boolean") return { ok: false, error: "AI output is missing is_valid_ledger_entry." };
  if (typeof d.whatsapp_reminder_draft !== "string" || typeof d.rejection_reason !== "string") {
    return { ok: false, error: "AI output is missing reminder / rejection fields." };
  }

  const result: ParsedLedgerResult = {
    ...(d as ParsedLedgerResult),
    customer_name: d.customer_name.trim(),
    total_amount: d.total_amount as number,
    amount_paid: d.amount_paid as number,
    credit_balance_change: d.credit_balance_change as number,
  };
  if (result.total_amount < 0) result.total_amount = 0;
  if (result.amount_paid < 0) result.amount_paid = 0;

  if (result.action_type === "payment") {
    result.total_amount = result.amount_paid;
    result.credit_balance_change = -result.amount_paid;
  } else if (result.action_type === "sale" || result.action_type === "credit") {
    // Trust the itemised breakdown when it is usable: e.g. "one dozen eggs"
    // with no price — the model may put the price on the item, not the total.
    const itemsSum = result.items.reduce((s, i) => s + i.amount, 0);
    if (result.items.length > 0 && itemsSum > 0 && Math.abs(itemsSum - result.total_amount) > 1 && result.amount_paid <= itemsSum) {
      result.total_amount = itemsSum;
    }
    if (result.amount_paid > result.total_amount) result.total_amount = result.amount_paid;
    result.credit_balance_change = result.total_amount - result.amount_paid;
  }
  return { ok: true, result };
}

/** Build a valid-but-rejected result (used when input is off-topic / injected). */
export function rejectedResult(reason: string): ParsedLedgerResult {
  return {
    action_type: "credit",
    customer_name: "",
    items: [],
    total_amount: 0,
    amount_paid: 0,
    credit_balance_change: 0,
    currency: "PKR",
    whatsapp_reminder_draft: "",
    is_valid_ledger_entry: false,
    rejection_reason: reason,
  };
}
