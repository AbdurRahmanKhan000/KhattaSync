/** Strict domain types for KhattaSync. No `any` is used in the public API. */

export type EntryStatus = "credit" | "paid" | "due" | "partial";
export type EntryType = "gave" | "got";
export type EntrySource = "text" | "voice" | "manual";

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

export interface UserSettings {
  shopName: string;
  ownerName: string;
  currency: "PKR";
  language: "en" | "ur";
  /** User-supplied Gemini key, stored only in this browser (IndexedDB). Never sent to our servers except to the Gemini API route the user explicitly calls. */
  geminiApiKey?: string;
  demoDataLoaded: boolean;
}

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
