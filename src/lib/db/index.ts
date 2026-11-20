import { openDB, type IDBPDatabase } from "idb";
import type { CustomerAccount, LedgerEntry, UserSettings } from "@/types";

export const DB_NAME = "khattasync-db";
export const DB_VERSION = 1;
export const STORE_ENTRIES = "entries";
export const STORE_CUSTOMERS = "customers";
export const STORE_SETTINGS = "settings";

/**
 * Strict browser isolation: every record is namespaced by the shop/owner id.
 * One browser profile = one shop's books; nothing is shared across shops
 * and nothing leaves the device (no server sync in v1).
 */
export function getOwnerScope(): string {
  if (typeof window === "undefined") return "server";
  const stored = window.localStorage.getItem("khattasync:owner-id");
  if (stored) return stored;
  const id = `shop-${crypto.randomUUID()}`;
  window.localStorage.setItem("khattasync:owner-id", id);
  return id;
}

export function scopedId(id: string): string {
  return `${getOwnerScope()}:${id}`;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
          const s = db.createObjectStore(STORE_ENTRIES, { keyPath: "id" });
          s.createIndex("by-customer", "customerId");
          s.createIndex("by-date", "date");
        }
        if (!db.objectStoreNames.contains(STORE_CUSTOMERS)) {
          db.createObjectStore(STORE_CUSTOMERS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function listEntries(): Promise<LedgerEntry[]> {
  const db = await getDB();
  return db.getAll(STORE_ENTRIES);
}

export async function addEntry(entry: LedgerEntry): Promise<void> {
  const db = await getDB();
  await db.put(STORE_ENTRIES, entry);
}

export async function listCustomers(): Promise<CustomerAccount[]> {
  const db = await getDB();
  return db.getAll(STORE_CUSTOMERS);
}

export async function saveSettings(settings: UserSettings & { id: string }): Promise<void> {
  const db = await getDB();
  await db.put(STORE_SETTINGS, settings);
}
