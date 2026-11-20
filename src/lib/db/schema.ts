import type { DBSchema } from "idb";
import type { AppSettings, CustomerAccount, EntryLog, LedgerEntry } from "../../types";

/**
 * 100% browser-isolated storage.
 * Database: `khattasync_local_db` — lives ONLY in the visiting user's own
 * browser (IndexedDB, per origin + per browser profile). There is no server
 * database of any kind: no SQLite, MySQL, PostgreSQL, or shared store.
 * Two users opening the same deployed URL at the same time each get their
 * own empty database; they can never see each other's customers or entries.
 */
export const DB_NAME = "khattasync_local_db";
export const DB_VERSION = 1;

export const STORE_CUSTOMERS = "customers";
export const STORE_TRANSACTIONS = "transactions";
export const STORE_ENTRY_LOGS = "entry_logs";
export const STORE_SETTINGS = "app_settings";

/** Backwards-compatible alias: transactions are ledger entries. */
export const STORE_ENTRIES = STORE_TRANSACTIONS;

export interface KhattaSyncDB extends DBSchema {
  customers: { key: string; value: CustomerAccount; indexes: { "by-name": string } };
  transactions: { key: string; value: LedgerEntry; indexes: { "by-customer": string; "by-date": string } };
  entry_logs: { key: string; value: EntryLog; indexes: { "by-date": string } };
  app_settings: { key: string; value: AppSettings };
}
