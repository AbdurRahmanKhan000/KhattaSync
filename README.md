# KhattaSync

AI-powered voice and text digital ledger (*khata* / *udhaar*) for neighbourhood
shopkeepers and small merchants.

## Stack
Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · `@google/genai` (official
Google Gen AI SDK) · `lucide-react` · `idb` (IndexedDB) · Gemini `gemini-3.8-flash`

## Quick start
```bash
npm install
cp .env.example .env.local   # add your GEMINI_API_KEY
npm run dev
```

## Structure
- `src/app/` — pages (`/`, `/customers`, `/settings`) and API routes (`/api/health`, `/api/ai/parse-entry`)
- `src/components/layout/` — Sidebar, Topbar, StatusBadge
- `src/components/ledger/` — TransactionEntryBar, VoiceRecorder, LedgerTable, CustomerCard, WhatsAppReminderModal
- `src/components/settings/` — ApiKeySettings, DataExportImport, AdminVault
- `src/components/shared/` — Toast, Skeleton, ConfirmDialog, DemoLoader
- `src/lib/db/` — IndexedDB wrapper, stores, migrations, browser-isolation helpers
- `src/lib/ai/` — Gemini client, strict JSON schema, guardrail prompts, model config
- `src/lib/security/` — admin auth, prompt-injection & off-topic filtering
- `src/lib/utils/` — PKR formatting, WhatsApp links, CSV/JSON export
- `src/types/` — LedgerEntry, CustomerAccount, AdminConfig, UserSettings
- `src/constants/` — demo data, system limits, error messages
- `docs/ui-ux-research.md` — Step 1 research summary

## Data & security
- All ledger data stays in the browser (IndexedDB). No server sync in v1.
- The Gemini key is used only by the server API route / the user's own browser setting.
- Admin Vault stores only a SHA-256 hash, never a plaintext password.
- AI input is filtered for prompt injection and off-topic requests before any model call.

## Verify
```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Persistence (Prompt 2)
- **Database:** IndexedDB only, `khattasync_local_db` — no server DB.
  Stores: `customers`, `transactions`, `entry_logs`, `app_settings`.
  Each browser profile has its own database, so hackathon users never see
  each other's data. Code: `src/lib/db/` (`schema`, `core`, `customers`,
  `transactions`, `entry-logs`, `settings`, `backup`, `seed`, `self-test`).
- **Sample data:** "Load Sample Shop Data" (`src/constants/` Peshawar
  grocery store, 6 customers / 10 transactions) writes only to the local DB.
- **Backup:** Settings → Export JSON backup / Import JSON backup (validated,
  version 1) / Clear My Local Data (this browser only).
- **Verify:** `npm run verify:db` (fake-indexeddb CRUD + balance + export/import),
  plus the in-app self-test on the Settings page.
  `npm run verify:db` runs `tsx scripts/verify-db.ts`.

## AI + Admin (Prompt 3)
- **Not a chatbot:** no chat UI. Gemini Structured Outputs (`responseMimeType: application/json`
  + `responseJsonSchema`) + server-side validation. Only sales, purchases, payments,
  udhaar, inventory notes, and reminder drafts (English / Urdu / Roman Urdu).
  Off-topic or injection input is rejected before any model call with:
  "KhattaSync only processes shop sales, customer credit (udhaar), and payment records."
  Strict result shape: `action_type, customer_name, items[], total_amount, amount_paid,
  credit_balance_change, currency, whatsapp_reminder_draft, is_valid_ledger_entry, rejection_reason`.
- **Route:** `POST /api/parse-ledger` (`action: parse | reminder`). Legacy `/api/ai/parse-entry` delegates to it.
- **Keys:** server `GEMINI_API_KEY` (.env, never sent to the browser) is the Host Hosted Key;
  a key saved in Settings (IndexedDB) is the Personal User API Key (BYOK) and always wins;
  if the Admin withdraws the host key, BYOK is enforced. Status badge in Settings shows Host / Personal / No key.
- **Model:** default `gemini-3.8-flash`, switchable to `gemini-3.5-flash-lite` (Admin), thinking budget low/standard/high.
  Note: only these two models are offered — gemini-2.5-flash was removed because Google
  retires it on December 1, 2026 (requests are then routed to gemini-3.5-flash-lite).
  A live Gemini call has not been verified here because no API key is configured —
  add a key and test once before demoing.
- **Admin Vault:** Settings → Admin Control Vault, password-protected (SHA-256 hash only, Web Crypto).
  Unlocked Admin can: withdraw/restore the host key, switch model + thinking budget,
  set max daily AI entries, toggle audio transcription, lock/unlock sample data, change the Admin password.
- **Verify:** `npm run verify:ai` (27 checks), `npm run verify:db`, `npm run verify:all`.
