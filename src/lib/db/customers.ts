import type { CustomerAccount, LedgerEntry } from "../../types";
import { getDB } from "./core";
import { STORE_CUSTOMERS, STORE_TRANSACTIONS } from "./schema";

/** Pure balance math — the single source of truth, unit-testable without IndexedDB. */
export function calculateCustomerTotals(transactions: LedgerEntry[]): { balance: number; totalGave: number; totalGot: number } {
  let totalGave = 0;
  let totalGot = 0;
  for (const t of transactions) {
    if (t.type === "gave") totalGave += t.amount;
    else totalGot += t.amount;
  }
  return { balance: totalGave - totalGot, totalGave, totalGot };
}

/** Overdue = still owes, and the oldest unpaid entry is > 7 days old. */
export function isCustomerOverdue(transactions: LedgerEntry[], now = new Date()): boolean {
  const { balance } = calculateCustomerTotals(transactions);
  if (balance <= 0) return false;
  const oldest = transactions
    .filter((t) => t.type === "gave")
    .map((t) => new Date(t.date).getTime())
    .sort((a, b) => a - b)[0];
  if (!oldest) return false;
  return now.getTime() - oldest > 7 * 24 * 60 * 60 * 1000;
}

export async function listCustomers(): Promise<CustomerAccount[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_CUSTOMERS);
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCustomer(id: string): Promise<CustomerAccount | undefined> {
  const db = await getDB();
  return db.get(STORE_CUSTOMERS, id);
}

export async function createCustomer(customer: CustomerAccount): Promise<void> {
  const db = await getDB();
  await db.put(STORE_CUSTOMERS, customer);
}

export async function updateCustomer(customer: CustomerAccount): Promise<void> {
  const db = await getDB();
  await db.put(STORE_CUSTOMERS, customer);
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_CUSTOMERS, STORE_TRANSACTIONS], "readwrite");
  await tx.objectStore(STORE_CUSTOMERS).delete(id);
  const idx = tx.objectStore(STORE_TRANSACTIONS).index("by-customer");
  for (const key of await idx.getAllKeys(id)) {
    await tx.objectStore(STORE_TRANSACTIONS).delete(key);
  }
  await tx.done;
}

/** Re-read that customer's transactions and rewrite balance / totals / overdue. */
export async function recalculateCustomerBalance(customerId: string): Promise<CustomerAccount | undefined> {
  const db = await getDB();
  const customer = await db.get(STORE_CUSTOMERS, customerId);
  if (!customer) return undefined;
  const transactions = await db.getAllFromIndex(STORE_TRANSACTIONS, "by-customer", customerId);
  const totals = calculateCustomerTotals(transactions);
  const updated: CustomerAccount = {
    ...customer,
    ...totals,
    isOverdue: isCustomerOverdue(transactions),
    lastActivity: transactions.map((t) => t.date).sort().at(-1) ?? customer.lastActivity,
  };
  await db.put(STORE_CUSTOMERS, updated);
  return updated;
}

export async function recalculateAllBalances(): Promise<void> {
  const customers = await listCustomers();
  for (const c of customers) await recalculateCustomerBalance(c.id);
}
