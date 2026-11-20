import { SAMPLE_SHOP_CUSTOMERS, SAMPLE_SHOP_ENTRY_LOGS, SAMPLE_SHOP_TRANSACTIONS } from "../../constants";
import { getDB } from "./core";
import { STORE_CUSTOMERS, STORE_ENTRY_LOGS, STORE_SETTINGS, STORE_TRANSACTIONS } from "./schema";
import { DEFAULT_SETTINGS, saveSettings } from "./settings";
import { recalculateAllBalances } from "./customers";

/**
 * "Load Sample Shop Data" — one click, local only.
 * Writes the Peshawar sample shop (6 customers, 10 transactions, 2 entry
 * logs) into THIS user's IndexedDB. If the ledger already has data it is
 * left alone unless `force` is true, so demo data can never silently wipe
 * a real khata.
 */
export async function loadSampleShopData(force = false): Promise<{ customers: number; transactions: number; entryLogs: number }> {
  const db = await getDB();
  const existing = await db.count(STORE_CUSTOMERS);
  if (existing > 0 && !force) {
    return { customers: existing, transactions: await db.count(STORE_TRANSACTIONS), entryLogs: await db.count(STORE_ENTRY_LOGS) };
  }
  const tx = db.transaction([STORE_CUSTOMERS, STORE_TRANSACTIONS, STORE_ENTRY_LOGS], "readwrite");
  if (force) {
    await Promise.all([
      tx.objectStore(STORE_CUSTOMERS).clear(),
      tx.objectStore(STORE_TRANSACTIONS).clear(),
      tx.objectStore(STORE_ENTRY_LOGS).clear(),
    ]);
  }
  for (const c of SAMPLE_SHOP_CUSTOMERS) await tx.objectStore(STORE_CUSTOMERS).put(c);
  for (const t of SAMPLE_SHOP_TRANSACTIONS) await tx.objectStore(STORE_TRANSACTIONS).put(t);
  for (const l of SAMPLE_SHOP_ENTRY_LOGS) await tx.objectStore(STORE_ENTRY_LOGS).put(l);
  await tx.done;
  await recalculateAllBalances();
  // Tell the dashboard provider to reload — otherwise the sidebar and
  // table keep showing the pre-seed (empty) state until a full refresh.
  if (typeof window !== "undefined") window.dispatchEvent(new Event("khattasync:data-changed"));
  await saveSettings({ ...DEFAULT_SETTINGS, shopName: "Peshawar General Store", demoDataLoaded: true });
  return {
    customers: SAMPLE_SHOP_CUSTOMERS.length,
    transactions: SAMPLE_SHOP_TRANSACTIONS.length,
    entryLogs: SAMPLE_SHOP_ENTRY_LOGS.length,
  };
}

export async function hasAnyLocalData(): Promise<boolean> {
  const db = await getDB();
  return (await db.count(STORE_CUSTOMERS)) > 0 || (await db.count(STORE_TRANSACTIONS)) > 0;
}

export { STORE_SETTINGS };
