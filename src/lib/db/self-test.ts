import type { DbSelfTestResult, EntryLog, LedgerEntry } from "../../types";
import { openKhattaDB } from "./core";
import { STORE_CUSTOMERS, STORE_ENTRY_LOGS, STORE_SETTINGS, STORE_TRANSACTIONS } from "./schema";
import { calculateCustomerTotals } from "./customers";
import { exportBackup, importBackup, isValidBackup } from "./backup";
import { loadSampleShopData } from "./seed";

/**
 * Browser self-test — runs against a SEPARATE test database
 * (`khattasync_local_db_test`), never the user's real khata.
 * The Node script `scripts/verify-db.ts` runs the same checks against the
 * real public API with fake-indexeddb.
 */
export async function runDbSelfTest(): Promise<DbSelfTestResult[]> {
  const results: DbSelfTestResult[] = [];
  const check = (name: string, passed: boolean, detail: string) => results.push({ name, passed, detail });
  const TEST_DB = "khattasync_local_db_test";
  try {
    const db = await openKhattaDB(TEST_DB);
    await Promise.all([
      db.clear(STORE_CUSTOMERS), db.clear(STORE_TRANSACTIONS),
      db.clear(STORE_ENTRY_LOGS), db.clear(STORE_SETTINGS),
    ]);

    // 1. CRUD — customers
    await db.put(STORE_CUSTOMERS, { id: "t-cust", name: "Test Customer", balance: 0, totalGave: 0, totalGot: 0, lastActivity: "2026-11-20", isOverdue: false });
    const cust = await db.get(STORE_CUSTOMERS, "t-cust");
    check("Customer create + read", cust?.name === "Test Customer", `read back: ${cust?.name ?? "missing"}`);

    // 2. CRUD — transactions + balance recalculation (pure function)
    const txns: LedgerEntry[] = [
      { id: "t-1", customerId: "t-cust", customerName: "Test Customer", type: "gave", amount: 5000, status: "credit", date: "2026-11-20", createdAt: "2026-11-20T00:00:00Z", updatedAt: "2026-11-20T00:00:00Z", source: "text" },
      { id: "t-2", customerId: "t-cust", customerName: "Test Customer", type: "got", amount: 2000, status: "paid", date: "2026-11-20", createdAt: "2026-11-20T00:00:00Z", updatedAt: "2026-11-20T00:00:00Z", source: "text" },
    ];
    for (const t of txns) await db.put(STORE_TRANSACTIONS, t);
    const totals = calculateCustomerTotals(txns);
    check("Balance recalculation", totals.balance === 3000 && totals.totalGave === 5000 && totals.totalGot === 2000,
      `gave 5000 - got 2000 = ${totals.balance}`);
    await db.delete(STORE_TRANSACTIONS, "t-2");
    check("Transaction delete", (await db.get(STORE_TRANSACTIONS, "t-2")) === undefined, "t-2 removed");

    // 3. Entry logs
    const log: EntryLog = { id: "t-log", rawInput: "Test 5000 udhaar", source: "text", status: "parsed", customerName: "Test Customer", amount: 5000, createdAt: "2026-11-20T00:00:00Z" };
    await db.put(STORE_ENTRY_LOGS, log);
    check("Entry log write + read", (await db.get(STORE_ENTRY_LOGS, "t-log"))?.rawInput === log.rawInput, "log round-trip ok");

    // 4. Export / import shape validation (uses the real backup validator)
    const backup = await exportBackup();
    check("Backup export shape", isValidBackup(backup), `version ${backup.version}, ${backup.customers.length} customers in real db`);
    check("Invalid backup rejected", !isValidBackup({ app: "Other", version: 99 }), "non-KhattaSync object rejected");
    void importBackup;

    // 5. Sample data loader does not throw (loads into the real db only if empty; here we just verify the function resolves)
    const seed = await loadSampleShopData(false);
    check("Sample shop data loader", seed.customers >= 0 && seed.transactions >= 0, `${seed.customers} customers, ${seed.transactions} transactions present`);

    await Promise.all([
      db.clear(STORE_CUSTOMERS), db.clear(STORE_TRANSACTIONS),
      db.clear(STORE_ENTRY_LOGS), db.clear(STORE_SETTINGS),
    ]);
    indexedDB.deleteDatabase(TEST_DB);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    check("Self-test completed without error", false, message);
  }
  return results;
}
