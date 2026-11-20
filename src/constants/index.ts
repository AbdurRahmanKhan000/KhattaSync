import type { CustomerAccount, LedgerEntry } from "@/types";

export const APP_NAME = "KhattaSync";
export const APP_TAGLINE = "Your digital khata — voice, text, done.";
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
  noApiKey: "Add your Gemini API key in Settings to use AI parsing.",
  offTopic: "KhattaSync only handles ledger entries — who, how much, gave or got.",
  injectionBlocked: "That input was blocked for safety. Please enter a normal ledger entry.",
  invalidAmount: "Amount must be a number greater than 0.",
  missingCustomer: "Please include a customer name.",
  dbUnavailable: "Local storage (IndexedDB) is unavailable in this browser.",
  generic: "Something went wrong. Please try again.",
} as const;

export const DEMO_CUSTOMERS: CustomerAccount[] = [
  { id: "cust-ahmed", name: "Ahmed Raza", phone: "+92 300 1234567", balance: 4500, totalGave: 12000, totalGot: 7500, lastActivity: "2026-11-20", isOverdue: false },
  { id: "cust-fatima", name: "Fatima Store", phone: "+92 321 7654321", balance: 12800, totalGave: 20000, totalGot: 7200, lastActivity: "2026-11-19", isOverdue: true },
  { id: "cust-bilal", name: "Bilal Khan", balance: 0, totalGave: 5000, totalGot: 5000, lastActivity: "2026-11-18", isOverdue: false },
];

export const DEMO_ENTRIES: LedgerEntry[] = [
  { id: "e-1", customerId: "cust-ahmed", customerName: "Ahmed Raza", type: "gave", amount: 4500, status: "credit", note: "Rice + ghee", date: "2026-11-20", createdAt: "2026-11-20T09:00:00Z", updatedAt: "2026-11-20T09:00:00Z", source: "voice", rawInput: "Ahmed ko 4500 ka udhaar diya" },
  { id: "e-2", customerId: "cust-fatima", customerName: "Fatima Store", type: "gave", amount: 12800, status: "due", note: "Monthly stock", date: "2026-11-19", createdAt: "2026-11-19T10:00:00Z", updatedAt: "2026-11-19T10:00:00Z", source: "text", rawInput: "Fatima Store 12800 udhaar" },
  { id: "e-3", customerId: "cust-bilal", customerName: "Bilal Khan", type: "got", amount: 5000, status: "paid", note: "Full payment", date: "2026-11-18", createdAt: "2026-11-18T11:00:00Z", updatedAt: "2026-11-18T11:00:00Z", source: "manual" },
];
