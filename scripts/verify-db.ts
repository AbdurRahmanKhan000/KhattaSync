/**
 * KhattaSync IndexedDB verification — run with: npm run verify:db
 * Uses fake-indexeddb (Node) so the real public API in src/lib/db is
 * exercised end-to-end: CRUD, balance recalculation, entry logs,
 * sample-data seeding, JSON export/import round-trip, and clear-all.
 * Exits non-zero on the first failure.
 */
import "fake-indexeddb/auto";
import {
  addTransaction,
  calculateCustomerTotals,
  clearAllLocalData,
  createCustomer,
  deleteCustomer,
  deleteTransaction,
  exportBackup,
  getCustomer,
  importBackup,
  isValidBackup,
  listCustomers,
  listEntryLogs,
  listTransactions,
  loadSampleShopData,
  logEntry,
  recalculateCustomerBalance,
} from "../src/lib/db/index.js";

let failures = 0;
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures += 1;
}
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  await clearAllLocalData();

  // 1. Empty first run — a new user sees nothing.
  check("Fresh DB is empty", (await listCustomers()).length === 0 && (await listTransactions()).length === 0);

  // 2. Customer CRUD
  await createCustomer({ id: "v-cust", name: "Verify Khan", phone: "+92 300 0000000", balance: 0, totalGave: 0, totalGot: 0, lastActivity: "2026-11-20", isOverdue: false });
  check("Customer create + read", (await getCustomer("v-cust"))?.name === "Verify Khan");

  // 3. Transactions + balance recalculation
  await addTransaction({ id: "v-1", customerId: "v-cust", customerName: "Verify Khan", type: "gave", amount: 5000, status: "credit", date: "2026-11-20", createdAt: "2026-11-20T00:00:00Z", updatedAt: "2026-11-20T00:00:00Z", source: "text", rawInput: "Verify Khan 5000 udhaar" });
  await addTransaction({ id: "v-2", customerId: "v-cust", customerName: "Verify Khan", type: "got", amount: 2000, status: "paid", date: "2026-11-20", createdAt: "2026-11-20T00:00:00Z", updatedAt: "2026-11-20T00:00:00Z", source: "voice" });
  const after = await getCustomer("v-cust");
  check("Balance recalculated (5000 gave - 2000 got = 3000)", after?.balance === 3000 && after?.totalGave === 5000 && after?.totalGot === 2000, `balance=${after?.balance}`);
  check("Pure balance math agrees", calculateCustomerTotals(await listTransactions()).balance === 3000);
  await deleteTransaction("v-2");
  const afterDelete = await recalculateCustomerBalance("v-cust");
  check("Balance after delete (5000 - 0 = 5000)", afterDelete?.balance === 5000, `balance=${afterDelete?.balance}`);

  // 4. Entry logs (voice/text history)
  await logEntry({ id: "v-log", rawInput: "Verify Khan 5000 udhaar", source: "text", status: "parsed", customerName: "Verify Khan", amount: 5000, transactionId: "v-1", createdAt: "2026-11-20T00:00:00Z" });
  check("Entry log CRUD", (await listEntryLogs()).length === 1);

  // 5. Export / import round-trip
  const backup = await exportBackup();
  check("Backup export is valid", isValidBackup(backup) && backup.transactions.length === 1, `${backup.customers.length} customers, ${backup.transactions.length} transactions`);
  check("Invalid backup rejected", !isValidBackup({ app: "Other", version: 99 }));
  await clearAllLocalData();
  check("Clear all wipes local data", (await listCustomers()).length === 0);
  const imported = await importBackup(JSON.parse(JSON.stringify(backup)) as unknown);
  check("Backup import restores counts", imported.customers === 1 && imported.transactions === 1, JSON.stringify(imported));
  check("Balance survives import", (await getCustomer("v-cust"))?.balance === 5000);

  // 6. Sample shop data (Peshawar) + customer delete cascade
  await clearAllLocalData();
  const seed = await loadSampleShopData(true);
  check("Sample shop data loads", seed.customers === 6 && seed.transactions === 10, `${seed.customers} customers, ${seed.transactions} transactions`);
  const imran = await getCustomer("cust-imran-afridi");
  check("Seeded balance is consistent (22000 gave, 0 got)", imran?.balance === 22000, `balance=${imran?.balance}`);
  await deleteCustomer("cust-rabia-bibi");
  check("Delete customer cascades its transactions", (await listTransactions()).every((t) => t.customerId !== "cust-rabia-bibi"));

  await clearAllLocalData();
  assert(failures === 0, `${failures} check(s) failed`);
  console.log("\nAll IndexedDB verification checks passed.");
}

main().catch((err: unknown) => {
  console.error("FAIL  verify-db crashed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
