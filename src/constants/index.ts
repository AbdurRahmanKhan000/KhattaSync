import type { CustomerAccount, EntryLog, LedgerEntry } from "@/types";

export const APP_NAME = "KhattaSync";
export const APP_TAGLINE = "Your digital ledger — voice, text, done.";
export const CURRENCY = "PKR" as const;

export const SYSTEM_LIMITS = {
  maxVoiceSeconds: 60,
  maxEntriesPerDay: 500,
  maxAmountPkr: 10_000_000,
  maxNoteLength: 280,
  maxCustomers: 2_000,
  aiTimeoutMs: 20_000,
  aiMaxRetries: 1,
} as const;

export const ERROR_MESSAGES = {
  noApiKey: "Add your AI key (Gemini, OpenAI, or Claude) in Settings to use AI parsing.",
  offTopic: "KhattaSync only handles ledger entries — who, how much, gave or got.",
  injectionBlocked: "That input was blocked for safety. Please enter a normal ledger entry.",
  invalidAmount: "Amount must be a number greater than 0.",
  missingCustomer: "Please include a customer name.",
  dbUnavailable: "Local storage (IndexedDB) is unavailable in this browser.",
  invalidBackup: "That file is not a valid KhattaSync backup.",
  ledgerOnly: "KhattaSync only processes shop sales, customer credit (udhaar), and payment records.",
  noAiKey: "No AI key available. Enter your own AI key (Gemini, OpenAI, or Claude) in Settings to use AI parsing.",
  hostKeyWithdrawn: "The host API key has been withdrawn by the Admin. Enter your own AI key (Gemini, OpenAI, or Claude) in Settings to continue.",
  generic: "Something went wrong. Please try again.",
} as const;

/**
 * "Load Sample Shop Data" — realistic Peshawar grocery / general-store udhaar.
 * Purely local: these rows are only ever written to the visiting user's own
 * IndexedDB by `loadSampleShopData()` in src/lib/db/seed.ts. Nothing is
 * shared, uploaded, or seeded on any server.
 */
export const SAMPLE_SHOP_CUSTOMERS: CustomerAccount[] = [
  { id: "cust-haji-gul", name: "Haji Gul Muhammad", phone: "+92 300 1112233", balance: 1450, totalGave: 8450, totalGot: 7000, lastActivity: "2026-11-20", isOverdue: false },
  { id: "cust-bibi-zainab", name: "Bibi Zainab", phone: "+92 321 4455667", balance: 3200, totalGave: 3200, totalGot: 0, lastActivity: "2026-11-19", isOverdue: false },
  { id: "cust-imran-afridi", name: "Imran Afridi", phone: "+92 333 9988776", balance: 22000, totalGave: 22000, totalGot: 0, lastActivity: "2026-11-15", isOverdue: true },
  { id: "cust-naseem-akta", name: "Naseem Akhtar", phone: "+92 345 5566778", balance: 0, totalGave: 6000, totalGot: 6000, lastActivity: "2026-11-18", isOverdue: false },
  { id: "cust-shahid-khan", name: "Shahid Khan", phone: "+92 312 2233445", balance: 6750, totalGave: 6750, totalGot: 0, lastActivity: "2026-11-20", isOverdue: false },
  { id: "cust-rabia-bibi", name: "Rabia Bibi", phone: "+92 301 6677889", balance: 2100, totalGave: 2100, totalGot: 0, lastActivity: "2026-11-17", isOverdue: false },
];

export const SAMPLE_SHOP_TRANSACTIONS: LedgerEntry[] = [
  { id: "txn-01", customerId: "cust-haji-gul", customerName: "Haji Gul Muhammad", type: "gave", amount: 4500, status: "credit", note: "Atta 20kg + ghee 5kg", date: "2026-11-20", createdAt: "2026-11-20T09:00:00Z", updatedAt: "2026-11-20T09:00:00Z", source: "voice", rawInput: "Haji Gul ko 4500 ka atta ghee udhaar diya" },
  { id: "txn-02", customerId: "cust-haji-gul", customerName: "Haji Gul Muhammad", type: "got", amount: 7000, status: "paid", note: "Cash payment", date: "2026-11-19", createdAt: "2026-11-19T10:00:00Z", updatedAt: "2026-11-19T10:00:00Z", source: "text", rawInput: "Haji Gul se 7000 milay" },
  { id: "txn-03", customerId: "cust-haji-gul", customerName: "Haji Gul Muhammad", type: "gave", amount: 3950, status: "credit", note: "Cheeni, chai patti, daal", date: "2026-11-18", createdAt: "2026-11-18T09:30:00Z", updatedAt: "2026-11-18T09:30:00Z", source: "manual" },
  { id: "txn-04", customerId: "cust-bibi-zainab", customerName: "Bibi Zainab", type: "gave", amount: 3200, status: "credit", note: "Monthly rashan", date: "2026-11-19", createdAt: "2026-11-19T11:00:00Z", updatedAt: "2026-11-19T11:00:00Z", source: "voice", rawInput: "Bibi Zainab ko 3200 ka rashan udhaar" },
  { id: "txn-05", customerId: "cust-imran-afridi", customerName: "Imran Afridi", type: "gave", amount: 15200, status: "due", note: "Cement + grocery, 10 din purana", date: "2026-11-15", createdAt: "2026-11-15T09:00:00Z", updatedAt: "2026-11-15T09:00:00Z", source: "text", rawInput: "Imran Afridi 15200 udhaar" },
  { id: "txn-06", customerId: "cust-naseem-akta", customerName: "Naseem Akhtar", type: "gave", amount: 6000, status: "paid", note: "Sabzi + fruit", date: "2026-11-18", createdAt: "2026-11-18T12:00:00Z", updatedAt: "2026-11-18T12:00:00Z", source: "manual" },
  { id: "txn-07", customerId: "cust-naseem-akta", customerName: "Naseem Akhtar", type: "got", amount: 6000, status: "paid", note: "Full payment, ledger clear", date: "2026-11-18", createdAt: "2026-11-18T18:00:00Z", updatedAt: "2026-11-18T18:00:00Z", source: "text", rawInput: "Naseem Akhtar ne 6000 ada kar diye" },
  { id: "txn-08", customerId: "cust-shahid-khan", customerName: "Shahid Khan", type: "gave", amount: 6750, status: "credit", note: "Cooking oil, rice, sugar", date: "2026-11-20", createdAt: "2026-11-20T08:30:00Z", updatedAt: "2026-11-20T08:30:00Z", source: "voice", rawInput: "Shahid Khan ko 6750 ka udhaar diya" },
  { id: "txn-09", customerId: "cust-rabia-bibi", customerName: "Rabia Bibi", type: "gave", amount: 2100, status: "credit", note: "Doodh + anda, weekly", date: "2026-11-17", createdAt: "2026-11-17T09:00:00Z", updatedAt: "2026-11-17T09:00:00Z", source: "manual" },
  { id: "txn-10", customerId: "cust-imran-afridi", customerName: "Imran Afridi", type: "gave", amount: 6800, status: "due", note: "Pehlay ka baqaya", date: "2026-11-10", createdAt: "2026-11-10T09:00:00Z", updatedAt: "2026-11-10T09:00:00Z", source: "text", rawInput: "Imran Afridi 6800 aur udhaar" },
];

export const SAMPLE_SHOP_ENTRY_LOGS: EntryLog[] = [
  { id: "log-01", rawInput: "Haji Gul ko 4500 ka atta ghee udhaar diya", source: "voice", status: "parsed", customerName: "Haji Gul Muhammad", amount: 4500, transactionId: "txn-01", createdAt: "2026-11-20T09:00:00Z" },
  { id: "log-02", rawInput: "Imran Afridi 15200 udhaar", source: "text", status: "parsed", customerName: "Imran Afridi", amount: 15200, transactionId: "txn-05", createdAt: "2026-11-15T09:00:00Z" },
];

/** Backwards-compatible aliases used by the dashboard / demo loader. */
export const DEMO_CUSTOMERS: CustomerAccount[] = SAMPLE_SHOP_CUSTOMERS;
export const DEMO_ENTRIES: LedgerEntry[] = SAMPLE_SHOP_TRANSACTIONS;

export const AI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gpt-4o-mini", "gpt-4o", "claude-haiku-4-5", "claude-sonnet-5"] as const;
export const DEFAULT_AI_MODEL = "gemini-3.5-flash-lite" as const;
export const AI_MODEL_LABELS: Record<string, string> = {
  "gemini-3.8-flash": "Gemini 3.8 Flash — fast",
  "gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite — fastest / cheapest (default)",
  "gpt-4o-mini": "GPT-4o mini — fast (default)",
  "gpt-4o": "GPT-4o — most capable OpenAI",
  "claude-haiku-4-5": "Claude Haiku 4.5 — fast (default)",
  "claude-sonnet-5": "Claude Sonnet 5 — balanced",
};
