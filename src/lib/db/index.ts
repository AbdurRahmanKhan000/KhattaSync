/**
 * KhattaSync persistence — 100% browser-isolated IndexedDB (`khattasync_local_db`).
 * No server database. Every function below reads/writes only the visiting
 * user's own browser. Optimistic UI: callers update local state first, then
 * await these (local, millisecond) writes — no spinners.
 */
export * from "./schema";
export * from "./core";
export * from "./customers";
export * from "./transactions";
export * from "./entry-logs";
export * from "./settings";
export * from "./backup";
export * from "./admin";
export * from "./seed";
export * from "./self-test";
