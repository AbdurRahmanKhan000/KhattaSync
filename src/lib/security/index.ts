import { createHash, timingSafeEqual } from "node:crypto";

const INJECTION_PATTERNS = [
  /ignore (all |any |previous |prior )?(instructions|prompts|rules)/i,
  /you are (now|a|an)\b/i,
  /system prompt/i,
  /reveal (your|the) (prompt|instructions|system)/i,
  /jailbreak/i,
  /do not (follow|obey)/i,
];

/** True when the text looks like a prompt-injection attempt. */
export function containsPromptInjection(input: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(input));
}

const LEDGER_KEYWORDS = [
  "udhaar", "khata", "gave", "got", "paid", "payment", "due", "credit",
  "diya", "liya", "baqi", "rupee", "rs", "pkr", "amount",
];

/** Ledger-only guardrail: the input must look like a money entry, not chat. */
export function isOffTopic(input: string): boolean {
  const lower = input.toLowerCase();
  const hasAmount = /\d/.test(input);
  const hasKeyword = LEDGER_KEYWORDS.some((k) => lower.includes(k));
  const hasName = /\b[A-Z][a-z]+\b/.test(input);
  return !(hasAmount && (hasKeyword || hasName));
}

export function hashAdminPassword(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

/** Constant-time comparison against the stored SHA-256 hash. */
export function verifyAdminPassword(password: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashAdminPassword(password), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}
