import type { LedgerEntry } from "../../types";
import { getDB } from "./core";
import { STORE_TRANSACTIONS } from "./schema";
import { recalculateCustomerBalance } from "./customers";

/** Optimistic-UI friendly: a single IndexedDB put, then a balance recalc. No spinners needed — reads are local and instant. */
export async function addTransaction(entry: LedgerEntry): Promise<LedgerEntry> {
  const db = await getDB();
  await db.put(STORE_TRANSACTIONS, entry);
  await recalculateCustomerBalance(entry.customerId);
  return entry;
}

export async function listTransactions(): Promise<LedgerEntry[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_TRANSACTIONS);
  return all.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function listTransactionsByCustomer(customerId: string): Promise<LedgerEntry[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex(STORE_TRANSACTIONS, "by-customer", customerId);
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getTransaction(id: string): Promise<LedgerEntry | undefined> {
  const db = await getDB();
  return db.get(STORE_TRANSACTIONS, id);
}

export async function updateTransaction(entry: LedgerEntry): Promise<void> {
  const db = await getDB();
  await db.put(STORE_TRANSACTIONS, { ...entry, updatedAt: new Date().toISOString() });
  await recalculateCustomerBalance(entry.customerId);
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDB();
  const entry = await db.get(STORE_TRANSACTIONS, id);
  await db.delete(STORE_TRANSACTIONS, id);
  if (entry) await recalculateCustomerBalance(entry.customerId);
}

/** Backwards-compatible aliases for the v1 scaffold API. */
export const listEntries = listTransactions;
export const addEntry = addTransaction;
