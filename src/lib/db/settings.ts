import type { AppSettings } from "../../types";
import { getDB } from "./core";
import { STORE_SETTINGS } from "./schema";

export const SETTINGS_ID = "app";

export const DEFAULT_SETTINGS: AppSettings = {
  id: SETTINGS_ID,
  shopName: "My Shop",
  ownerName: "",
  currency: "PKR",
  language: "en",
  demoDataLoaded: false,
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  const saved = await db.get(STORE_SETTINGS, SETTINGS_ID);
  return saved ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put(STORE_SETTINGS, { ...settings, id: SETTINGS_ID });
}
