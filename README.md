# KhattaSync

AI-powered voice and text digital ledger (*khata* / *udhaar*) for neighbourhood
shopkeepers and small merchants.

## Stack
Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · `@google/genai` (official
Google Gen AI SDK) · `lucide-react` · `idb` (IndexedDB) · Gemini `gemini-2.5-flash`

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
