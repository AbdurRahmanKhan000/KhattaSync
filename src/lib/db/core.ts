import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, STORE_ADMIN, STORE_CUSTOMERS, STORE_ENTRY_LOGS, STORE_SETTINGS, STORE_TRANSACTIONS, type KhattaSyncDB } from "./schema";

export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Extra namespacing inside one browser: a per-shop owner id in localStorage.
 * IndexedDB already isolates per browser profile; this keeps books separate
 * if one device is ever shared between two shops. In Node / tests there is
 * no window, so the scope is the fixed string "server" (test-only).
 */
export function getOwnerScope(): string {
  if (!isBrowser()) return "server";
  const stored = window.localStorage.getItem("khattasync:owner-id");
  if (stored) return stored;
  const id = `shop-${crypto.randomUUID()}`;
  window.localStorage.setItem("khattasync:owner-id", id);
  return id;
}

export function scopedId(id: string): string {
  return `${getOwnerScope()}:${id}`;
}

const dbCache = new Map<string, Promise<IDBPDatabase<KhattaSyncDB>>>();

export function openKhattaDB(name: string = DB_NAME): Promise<IDBPDatabase<KhattaSyncDB>> {
  const cached = dbCache.get(name);
  if (cached) return cached;
  const p = openDB<KhattaSyncDB>(name, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_ADMIN)) {
        db.createObjectStore(STORE_ADMIN, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_CUSTOMERS)) {
        const s = db.createObjectStore(STORE_CUSTOMERS, { keyPath: "id" });
        s.createIndex("by-name", "name");
      }
      if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
        const s = db.createObjectStore(STORE_TRANSACTIONS, { keyPath: "id" });
        s.createIndex("by-customer", "customerId");
        s.createIndex("by-date", "date");
      }
      if (!db.objectStoreNames.contains(STORE_ENTRY_LOGS)) {
        const s = db.createObjectStore(STORE_ENTRY_LOGS, { keyPath: "id" });
        s.createIndex("by-date", "createdAt");
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "id" });
      }
    },
  });
  dbCache.set(name, p);
  return p;
}

export function getDB(): Promise<IDBPDatabase<KhattaSyncDB>> {
  return openKhattaDB(DB_NAME);
}

export function closeDB(): void {
  dbCache.clear();
}
