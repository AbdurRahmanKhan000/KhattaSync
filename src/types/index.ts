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

export interface AdminConfig {
  vaultEnabled: boolean;
  /** SHA-256 hex of the admin password. Plaintext is never stored. */
  passwordHash?: string;
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
