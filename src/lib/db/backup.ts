import type { BackupData } from "../../types";
import { getDB, getOwnerScope } from "./core";
import { STORE_CUSTOMERS, STORE_ENTRY_LOGS, STORE_SETTINGS, STORE_TRANSACTIONS } from "./schema";
import { getSettings } from "./settings";

/** Export the whole local khata as one versioned JSON object. Nothing leaves the browser unless the user downloads / shares this file. */
export async function exportBackup(): Promise<BackupData> {
  const db = await getDB();
  const [customers, transactions, entryLogs] = await Promise.all([
    db.getAll(STORE_CUSTOMERS),
    db.getAll(STORE_TRANSACTIONS),
    db.getAll(STORE_ENTRY_LOGS),
  ]);
  const settings = await getSettings();
  return {
    version: 1,
    app: "KhattaSync",
    exportedAt: new Date().toISOString(),
    ownerScope: getOwnerScope(),
    customers,
    transactions,
    entryLogs,
    settings,
  };
}

export function isValidBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== "object") return false;
  const d = data as Partial<BackupData>;
  return d.app === "KhattaSync" && d.version === 1 && Array.isArray(d.customers) && Array.isArray(d.transactions) && Array.isArray(d.entryLogs);
}

/** Import a backup: validates first, then replaces local data in one transaction per store. Returns counts so the UI can confirm. */
function notifyLocalDataChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("khattasync:data-changed"));
}

export async function importBackup(data: unknown): Promise<{ customers: number; transactions: number; entryLogs: number }> {
  if (!isValidBackup(data)) throw new Error("That file is not a valid KhattaSync backup.");
  const db = await getDB();
  const tx = db.transaction([STORE_CUSTOMERS, STORE_TRANSACTIONS, STORE_ENTRY_LOGS, STORE_SETTINGS], "readwrite");
  await Promise.all([
    tx.objectStore(STORE_CUSTOMERS).clear(),
    tx.objectStore(STORE_TRANSACTIONS).clear(),
    tx.objectStore(STORE_ENTRY_LOGS).clear(),
    tx.objectStore(STORE_SETTINGS).clear(),
  ]);
  for (const c of data.customers) await tx.objectStore(STORE_CUSTOMERS).put(c);
  for (const t of data.transactions) await tx.objectStore(STORE_TRANSACTIONS).put(t);
  for (const l of data.entryLogs) await tx.objectStore(STORE_ENTRY_LOGS).put(l);
  if (data.settings) await tx.objectStore(STORE_SETTINGS).put(data.settings);
  await tx.done;
  notifyLocalDataChanged();
  return { customers: data.customers.length, transactions: data.transactions.length, entryLogs: data.entryLogs.length };
}

/** "Clear My Local Data" — wipes every store in this browser only. Other users' browsers are untouched. */
export async function clearAllLocalData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_CUSTOMERS, STORE_TRANSACTIONS, STORE_ENTRY_LOGS, STORE_SETTINGS], "readwrite");
  await Promise.all([
    tx.objectStore(STORE_CUSTOMERS).clear(),
    tx.objectStore(STORE_TRANSACTIONS).clear(),
    tx.objectStore(STORE_ENTRY_LOGS).clear(),
    tx.objectStore(STORE_SETTINGS).clear(),
  ]);
  await tx.done;
  notifyLocalDataChanged();
}
