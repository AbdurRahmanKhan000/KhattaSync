/** Strict domain types for KhattaSync. No `any` is used in the public API. */

export type EntryStatus = "credit" | "paid" | "due" | "partial";
export type EntryType = "gave" | "got";
export type EntrySource = "text" | "voice" | "manual";

/** One ledger line. Stored in the `transactions` IndexedDB store. */
export interface LedgerEntry {
  id: string;
  customerId: string;
  customerName: string;
  type: EntryType;
  /** Amount in PKR (whole rupees). Always > 0. */
  amount: number;
  status: EntryStatus;
  note?: string;
  /** ISO date, e.g. 2026-11-20 */
  date: string;
  createdAt: string;
  updatedAt: string;
  source: EntrySource;
  rawInput?: string;
}

/** Alias: a transaction IS a ledger entry in KhattaSync. */
export type Transaction = LedgerEntry;

export interface CustomerAccount {
  id: string;
  name: string;
  phone?: string;
  /** Positive = customer owes the shop. Negative = shop owes the customer. */
  balance: number;
  totalGave: number;
  totalGot: number;
  lastActivity: string;
  isOverdue: boolean;
}

export type EntryLogStatus = "parsed" | "failed" | "pending";

/** One past voice/text command, kept in the `entry_logs` store. */
export interface EntryLog {
  id: string;
  rawInput: string;
  source: EntrySource;
  status: EntryLogStatus;
  customerName?: string;
  amount?: number;
  transactionId?: string;
  error?: string;
  createdAt: string;
}

export interface UserSettings {
  shopName: string;
  ownerName: string;
  currency: "PKR";
  language: "en" | "ur";
  /** User-supplied Gemini key, stored only in this browser (IndexedDB). */
  geminiApiKey?: string;
  demoDataLoaded: boolean;
}

/** Stored in `app_settings` under id "app". */
export type AppSettings = UserSettings & { id: string };

/* ---- AI layer (Prompt 3) ---- */

export type AiModel = "gemini-3.8-flash" | "gemini-3.5-flash-lite";
export type AiKeyMode = "host" | "personal" | "none";
export type ThinkingBudget = "low" | "standard" | "high";
export type LedgerActionType = "sale" | "purchase" | "payment" | "credit" | "inventory_note" | "reminder";

export interface LedgerItem {
  name: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
}

/** The ONLY shape Gemini may return, enforced by responseSchema AND server validation. */
export interface ParsedLedgerResult {
  action_type: LedgerActionType;
  customer_name: string;
  items: LedgerItem[];
  total_amount: number;
  amount_paid: number;
  credit_balance_change: number;
  currency: "PKR";
  whatsapp_reminder_draft: string;
  is_valid_ledger_entry: boolean;
  rejection_reason: string;
}

export interface AdminConfig {
  id: string;
  vaultEnabled: boolean;
  /** SHA-256 hex of the admin password. Plaintext is never stored. */
  passwordHash: string;
  /** Admin withdrew the server host key: AI may only run with the user's own key. */
  hostKeyWithdrawn: boolean;
  model: AiModel;
  thinkingBudget: ThinkingBudget;
  /** Max AI-parsed entries per browser session (per day, local). */
  maxDailyEntries: number;
  audioTranscriptionEnabled: boolean;
  sampleDataLocked: boolean;
  lockedAt?: string;
}

export interface ParsedLedgerInput {
  customerName: string;
  type: EntryType;
  amount: number;
  note?: string;
  date?: string;
  confidence: number;
}

/** Whole-khata JSON backup (export / import). Versioned, so imports can be rejected safely. */
export interface BackupData {
  version: 1;
  app: "KhattaSync";
  exportedAt: string;
  ownerScope: string;
  customers: CustomerAccount[];
  transactions: LedgerEntry[];
  entryLogs: EntryLog[];
  settings: AppSettings | null;
}

export interface DbSelfTestResult {
  name: string;
  passed: boolean;
  detail: string;
}
