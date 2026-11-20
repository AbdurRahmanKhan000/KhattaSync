import type { EntryLog } from "../../types";
import { getDB } from "./core";
import { STORE_ENTRY_LOGS } from "./schema";

export async function logEntry(entry: EntryLog): Promise<void> {
  const db = await getDB();
  await db.put(STORE_ENTRY_LOGS, entry);
}

export async function listEntryLogs(): Promise<EntryLog[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_ENTRY_LOGS);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function clearEntryLogs(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_ENTRY_LOGS);
}
