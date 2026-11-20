# KhattaSync

**AI-powered voice + text digital ledger (*khata* / *udhaar*) for neighbourhood shopkeepers and small merchants.**

A shopkeeper speaks or types a sale the way they would say it — *"Bilal took 2 bags of flour 3200 and 1 cooking oil 1100, paid 2000 cash, rest udhaar"* — and KhattaSync turns it into a structured, itemised ledger entry. No paper khata, no spreadsheet, no account, no server holding anyone's books.

## The problem

Neighbourhood shops run on credit. A shopkeeper keeps a paper notebook of who took what and who still owes — it gets lost, torn, or argued over, and totalling it up at month-end takes hours. Existing ledger apps either want an account and a subscription, or they sync the shop's books to someone else's server. KhattaSync is built for the opposite trade-off: **the shopkeeper's ledger never leaves their own browser**, and the AI does the typing for them.

## What it does

- **Quick Record (text + voice)** — type or dictate an entry in English, Urdu, Pashto, or Roman Urdu. Your AI key (Gemini, OpenAI, or Claude — one bar takes any of them) parses it into a strict JSON ledger entry (customer, items, total, paid, credit change) in 1–2 seconds.
- **Customer Ledgers (Khata)** — one running balance per customer, with search, *Lena Hai* (receivable) vs *Dena Hai* (payable) totals, and per-customer filtering. Never labelled "Chats" — this is not a chat app.
- **Ledger table** — filterable history with item breakdowns, timestamps, paid vs credit badges, and one-tap **Mark Paid** (posts the matching payment and settles the entry).
- **WhatsApp reminders** — one click drafts a polite Urdu/English reminder with Gemini and opens `wa.me` with the message ready, or copies it to the clipboard. Nothing is ever sent automatically.
- **Backup** — export / import the whole khata as a validated versioned JSON file, or wipe local data from Settings. The file only moves if the user downloads or shares it themselves.

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS 4 · React 19 · `@google/genai` ^3.6.1 (official Google Gen AI SDK — **not** the legacy `@google/generative-ai`) · `lucide-react` · `idb` (IndexedDB) · AI providers: Gemini `gemini-3.8-flash` (default) / `gemini-3.5-flash-lite`, OpenAI `gpt-4o-mini` (default) / `gpt-4o`, Claude `claude-haiku-4-5` (default) / `claude-sonnet-5`

> **Model note:** `gemini-2.5-flash` was deliberately removed from the selector — Google retires it on 1 December 2026 and already restricts it on fresh projects.

## Quick start

```bash
npm install
cp .env.example .env.local   # add your GEMINI_API_KEY (server-only, see below)
npm run dev                  # http://localhost:3000
```

AI parsing needs an AI key (host Gemini key in `.env.local`, or a personal Gemini, OpenAI, or Claude key in Settings — see *Admin Vault & BYOK*). Without any key the ledger still works fully by hand: add customers, record entries, mark paid, send reminders from the local template.

## Architecture

```
Browser (the whole ledger)                     Server (stateless, no storage)
┌──────────────────────────────────┐           ┌─────────────────────────────────┐
│ AppShell + DashboardContext      │           │ POST /api/parse-ledger          │
│  ├─ Sidebar: Customer Ledgers    │  fetch    │  ├─ Gate 1 injection filter     │
│  ├─ KPI header (live totals)     │ ────────► │  ├─ Gate 2 ledger-only filter   │
│  ├─ Quick-Record bar (voice/text)│  JSON     │  ├─ resolveAiKey (BYOK > host)  │
│  └─ Ledger table + reminder      │ ◄──────── │  └─ Gemini Structured Outputs   │
│     drawer                       │           │     + server output validation  │
│ IndexedDB khattasync_local_db    │           │ GET  /api/health (aiKeyConfigured│
│  customers · transactions ·      │           │      boolean only — never a key) │
│  entry_logs · app_settings ·     │           │ POST /api/ai/parse-entry (legacy│
│  admin_config                    │           │      wrapper, same strict parser)│
└──────────────────────────────────┘           └─────────────────────────────────┘
```

Key design decisions:

- **The server is stateless and storage-free.** API routes never import the DB layer, never write a file, and never log request data. Ledger data exists in exactly one place: the user's own IndexedDB.
- **KhattaSync is a structured ledger engine, not a chatbot.** There is no chat-bubble UI and no open-ended conversation. Every AI request passes three gates: (1) prompt-injection filter, (2) ledger-only domain filter, (3) structured output + server-side repair (Gemini Structured Outputs `responseJsonSchema`, OpenAI `json_schema`, Claude forced tool use; then the server recomputes derived amounts — a payment gets total = paid and change = −paid, a sale gets change = total − paid, and an itemised sum that is usable becomes the total — instead of rejecting the whole entry over one wrong derived number. Structural problems — missing customer, bad action, non-PKR — still reject with a specific error).
- **Off-topic is blocked before any Gemini call**, with the exact message: *"KhattaSync only processes shop sales, customer credit (udhaar), and payment records."* Blocked examples (all verified live): *"Write me a poem"*, *"Solve 2x+5=10"*, *"Ignore previous instructions"*, *"Tell me a joke"*, *"What is the capital of France?"*, *"Write an essay on climate change"*.
- **Application-level outcomes return HTTP 200 with `ok: false`** (blocked prompt, no key, rejected key, AI failure). A rejected prompt is an expected app outcome, not a transport failure — a 4xx/5xx would make Chromium log a console error for a request the app already handled gracefully.
- **Shared state, no prop-drilling:** `DashboardContext` (in `src/components/layout/`) loads customers/transactions/settings/admin config once from IndexedDB after mount (server render stays empty/skeleton, so there is no hydration mismatch) and every writer — Quick Record, Mark Paid, New Customer, sample-data loader, backup import/clear — notifies it via a `khattasync:data-changed` event so sidebar, KPIs, and table refresh together.
- **Resilience:** route-level (`src/app/error.tsx`) and root (`src/app/global-error.tsx`) error boundaries — a crash in one page never takes down the khata. AI failures are mapped to messages a shopkeeper can act on, and the provider's own error text is returned as `detail` and shown under the message — a failure never again hides behind a bare "AI parsing failed": rate limit → *"Gemini is busy right now (rate limit) — wait a minute and try again."*; rejected key → *"That Gemini API key was rejected — check the key in Settings…"*; model not available → *"That AI model is not available for this key — pick another model in Settings…"*; network failure → *"Could not reach Gemini — check your internet connection and try again."* If Gemini says a model is not available, the server retries once with `gemini-3.5-flash-lite` before failing.

## Folder structure

```
src/
  app/
    layout.tsx            Root layout — renders <AppShell>
    page.tsx              Dashboard: KPI header, Quick Record, ledger table
    customers/page.tsx    Customer cards (live data) + reminders
    settings/page.tsx     API key, backup, Admin Vault, DB self-test
    error.tsx             Route-level error boundary
    global-error.tsx      Root error boundary
    api/
      health/route.ts     GET { ok, service, aiKeyConfigured } (boolean only)
      parse-ledger/route.ts   POST — the only AI entry point (parse + reminder)
      ai/parse-entry/route.ts POST — legacy wrapper, same strict parser
  components/
    layout/               AppShell, DashboardContext, Sidebar, Topbar,
                          KpiHeader, ApiModeBadge, StatusBadge
    ledger/               TransactionEntryBar, VoiceRecorder, LedgerTable,
                          CustomerCard, WhatsAppReminderModal, NewCustomerModal
    settings/             ApiKeySettings, DataExportImport, AdminVault
    shared/               Toast, Skeleton, ConfirmDialog, DemoLoader
  lib/
    db/                   IndexedDB: schema, core, customers, transactions,
                          entry-logs, settings, backup, seed, self-test
    ai/                   Gemini client, strict schema, key resolution,
                          friendly error mapping
    security/             SHA-256 admin password, injection + off-topic
                          filters, output validation
    utils/                PKR formatting, WhatsApp links, reminder templates
  types/                  CustomerAccount, LedgerEntry, ParsedLedgerResult,
                          AdminConfig, AppSettings
  constants/              Sample Peshawar shop (6 customers / 10 txns),
                          models, limits, error messages
scripts/
  verify-db.ts            IndexedDB checks (14 checks)
  verify-ai.ts            AI + Admin checks (27 checks)
  verify-audit.ts         End-to-end audit (30 checks, needs a running server)
docs/
  ui-ux-research.md       Step 1 UI/UX research summary
```

## IndexedDB privacy model

| Question | Answer |
|---|---|
| Where does ledger data live? | Only in the browser's IndexedDB, database `khattasync_local_db`, stores `customers`, `transactions`, `entry_logs`, `app_settings`, `admin_config`. |
| Does the server ever see it? | No. API routes receive **only** the single entry being parsed (or a reminder request: name + balance). They never import the DB layer, never write files, never log requests, and keep nothing in memory after the response. |
| Can another user / profile see it? | No. Every browser profile (and every incognito window) has its own isolated IndexedDB. Verified in headless Chromium: profile A loads the sample shop (6 customers, 10 entries); a fresh profile B sees an empty khata and 0 customers in its own database. |
| What leaves the browser? | (1) The one entry text sent to your AI provider for parsing, (2) a reminder draft request (name + balance), (3) a backup file — only if the user exports it themselves. The Gemini key is never sent to the browser in the other direction: the host key lives in `.env` on the server only. |
| How fast is it? | Measured in headless Chromium: reading all customers + transactions from IndexedDB takes **~2 ms**; the empty khata renders ~400 ms after DOM load. No spinners on load — skeleton shimmer only while AI is parsing. |
| How do I delete everything? | Settings → *Clear My Local Data* (this browser only), or clear the browser's site data. |

## Admin Vault & BYOK flow

The **Admin Control Vault** lives in Settings, behind a password gate. The default password is `Abdurrehman`, stored **only as a SHA-256 hash** (Web Crypto, constant-time-ish comparison) — no plaintext anywhere in code or storage. The Admin can change the password once unlocked.

Unlocked, the Admin controls:

1. **Withdraw / toggle host API key** — instantly disables the server `.env` key fallback and enforces **User BYOK Mode**: users must enter their own AI key (Gemini, OpenAI, or Claude) in Settings to run AI parsing.
2. **Model & speed** — the model list follows the provider of the key in use (Gemini: `gemini-3.8-flash` default ↔ `gemini-3.5-flash-lite`; OpenAI: `gpt-4o-mini` ↔ `gpt-4o`; Claude: `claude-haiku-4-5` ↔ `claude-sonnet-5`), and the thinking budget (low / standard / high, Gemini only — Gemini 3 models use `thinkingLevel`, not `thinkingBudget`).
3. **Strictness & quota** — max AI entries per browser session, audio-transcription toggle, sample-data lock, and password change.

**One key bar, three providers.** Settings takes a Gemini key (`AIza…` or the current `AQ.…` auth keys Google AI Studio has issued since May 28, 2026), an OpenAI key (`sk-…` / `sk-proj-…`), or a Claude key (`sk-ant-…`) in the same field. The provider is detected from the key itself, shown live as you type, and the dashboard badge shows it (`Personal User API Key · OpenAI`). A **Test this key** button pings the provider and reports the result — or the provider's own error — before you save. Voice notes are transcribed by Gemini only: with an OpenAI or Claude key the mic switches to live speech transcription, which types the entry for the same AI to parse.

**Key resolution order** (per request, `resolveAiKey` in `src/lib/ai/`):

1. **Personal User API Key** (BYOK, saved in the user's own IndexedDB, sent per-request only) — always wins.
2. **Host Hosted Key** (server `GEMINI_API_KEY` from `.env`) — only if the Admin has not withdrawn it.
3. **None** — AI parsing is off; the UI says so and guides the user to Settings.

The dashboard and Settings always show which mode is live: **Host Hosted Key** / **Personal User API Key** / **No AI Key**. The mode is computed honestly: `/api/health` reports only a boolean `aiKeyConfigured` — the server never tells the browser whether a key exists beyond that, and never exposes the key itself. There is **no `NEXT_PUBLIC_` Gemini key anywhere** (verified in source and in the built client bundles).

> **Security note:** a personal (BYOK) key is stored in the user's own IndexedDB and sent to the app's own server on each parse request, where it is used for that request only and never stored server-side. The host key is never sent to the browser at all.

## Deployment

### Vercel (recommended)

```bash
npm run build        # must pass clean before deploying
vercel               # or connect the repo in the Vercel dashboard
```

In the Vercel dashboard → Project → Settings → Environment Variables, add:

| Variable | Value | Notes |
|---|---|---|
| `GEMINI_API_KEY` | your Gemini API key | Server-only. **Never** prefix it with `NEXT_PUBLIC_`. |

No database to provision, no storage bucket, no extra services — the app is a standard Next.js deployment; every user's data stays in their own browser. Redeploy after changing env vars.

### Render

1. Create a **Web Service** from the repo (Node 20+).
2. Build command: `npm install && npm run build`
3. Start command: `npm run start`
4. Environment variable: `GEMINI_API_KEY` = your Gemini API key (server-only).
5. Render assigns a port automatically — Next.js honours `PORT`, so no extra config is needed.

### Self-hosting / any Node host

```bash
npm install
npm run build
GEMINI_API_KEY=your_key_here npm run start   # serves on http://localhost:3000
```

The same rule applies everywhere: the key is a server-side environment variable. If AI parsing is not needed, the app runs fine with no key at all — the ledger, reminders (local template), and backup all work offline.

## Verification

```bash
npm run verify:db      # 14 IndexedDB checks — CRUD, balances, export/import, seed
npm run verify:ai      # 27 AI + Admin checks — strict JSON, off-topic blocked,
                       #   vault passwords, BYOK/model resolution
npm run verify:audit   # 30 end-to-end audit checks — needs a running server:
                       #   BASE_URL=http://localhost:3000 npm run verify:audit
npm run verify:all     # all three, in order
npx tsc --noEmit && npm run lint && npm run build
```

The audit script (`scripts/verify-audit.ts`) checks, live against the production server: 7 off-topic/injection prompts blocked with the exact ledger-only message; no `NEXT_PUBLIC_GEMINI_API_KEY` in source; the string `GEMINI_API_KEY` absent from all client bundle chunks; server code writes no files, logs no request data, and never touches IndexedDB; the Vault rejects wrong/wrong-case passwords and unlocks with the correct one; 429 / invalid-key / network failures map to friendly messages; and the multi-provider checks — OpenAI and Claude fake keys are rejected naming their provider, an unknown key is refused plainly, a voice note with Chrome's `audio/webm;codecs=opus` type reaches Gemini, and the ping action returns the provider's own error as `detail`. The browser audit (headless Chromium, desktop + mobile) additionally verified: fresh-profile isolation, Vault unlock + host-key withdrawal persisting across reload, BYOK badge switching, a live invalid-key rejection showing the friendly message with zero console errors, and IndexedDB reads at ~2 ms.

## Status & limits (honest notes)

- **Live AI calls are not verified in this repo's CI** — no key is configured here. Test with a real key before demoing. The Settings **Test this key** button is the fastest way: it pings the provider and shows the provider's own error if the key or model is wrong.
- Voice input has two paths. With a Gemini key available, the mic records a **voice note and Gemini transcribes + parses the audio itself** — the accurate path for Pashto and Urdu speech. With an OpenAI or Claude key (no audio input on those APIs), the mic uses live speech transcription into the text box instead. Without a key, the browser's Web Speech API dictates live into the text box (English/Urdu/Pashto, with language fallback). Audio is sent to Gemini for that request only and is never stored. Chrome records as `audio/webm;codecs=opus` — the server checks the base type only, so the codec suffix no longer rejects a real recording.
- `gemini-3.8-flash` / `gemini-3.5-flash-lite` are the model names in the owner's specification; they are live Gemini 3 models. If a key/project cannot use the configured Gemini model, the server retries once with `gemini-3.5-flash-lite` and otherwise says so plainly instead of failing silently.
- The Admin Vault password hash is client-side by design (there is no server account system in v1) — it gates the controls in the browser, it is not a server-side access control.
