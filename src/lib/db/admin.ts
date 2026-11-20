import type { AdminConfig } from "../../types";
import { DEFAULT_ADMIN_PASSWORD_HASH } from "../security";
import { getDB } from "./core";
import { STORE_ADMIN } from "./schema";

export const ADMIN_CONFIG_ID = "admin";

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  id: ADMIN_CONFIG_ID,
  vaultEnabled: true,
  passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
  hostKeyWithdrawn: false,
  model: "gemini-3.5-flash-lite",
  thinkingBudget: "standard",
  maxDailyEntries: 500,
  audioTranscriptionEnabled: true,
  sampleDataLocked: false,
};

export async function getAdminConfig(): Promise<AdminConfig> {
  const db = await getDB();
  const saved = await db.get(STORE_ADMIN, ADMIN_CONFIG_ID);
  return saved ?? DEFAULT_ADMIN_CONFIG;
}

export async function saveAdminConfig(config: AdminConfig): Promise<void> {
  const db = await getDB();
  await db.put(STORE_ADMIN, { ...config, id: ADMIN_CONFIG_ID });
}

/** BYOK is enforced when the Admin withdrew the host key. */
export function isByokEnforced(config: AdminConfig): boolean {
  return config.hostKeyWithdrawn;
}
