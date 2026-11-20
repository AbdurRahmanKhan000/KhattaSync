# KhattaSync — UI/UX Research (Step 1)

Sources searched 2026-11-20:
- Mercury business-banking aesthetic — clean white backgrounds, purple CTAs, card-based layouts, data-dense tables: https://www.hashbuilds.com/patterns/what-is-mercury-aesthetic
- Khatabook case study — party-first khata, "You Gave / You Got", home = balances + next collection: https://www.krennolabs.com/work/khatabook
- Dashboard best practices 2025–2026 — Inter + JetBrains Mono, tabular numerals, badges 11–12px uppercase: https://github.com/tshrjn/evolve-swarm/blob/HEAD/thoughts/taras/research/2026-02-25-dashboard-ui-design-best-practices.md
- Dashboard dos & don'ts — 5–7 widgets max, colour only for meaning, progressive disclosure: https://www.designmonks.co/blog/dashboard-design-dos-and-donts

## Colour palette (applied)
- Paper background `#F8F7F4`, surface white `#FFFFFF`, ink `#171717`, muted `#6B7280`, border `#E7E5E4`
- Primary emerald `#047857` (trust, money, calm — not a bank-blue clone)
- Status badges, always paired with a word, never colour alone:
  - Credit (udhaar given) — amber bg `#FEF3C7`, text `#92400E`
  - Paid — emerald bg `#D1FAE5`, text `#065F46`
  - Due / overdue — red bg `#FEE2E2`, text `#991B1B`
  - Partial — sky bg `#E0F2FE`, text `#075985`

## Typography
- Inter for UI/body (600 for titles, 400/500 for body, 13–14px body, 20–24px page titles)
- JetBrains Mono for amounts, dates and IDs, with tabular numerals so PKR columns align
- Badges: 11–12px, semibold, uppercase, wide tracking

## Layout principles (applied)
1. Party-first, like Khatabook: the customer is the primary object, not the invoice.
2. Card-based SaaS dashboard, Mercury-style: KPI cards on top, one ledger table card, customer cards in a grid. Max 5–7 widgets per view.
3. Hierarchy first: To Collect / Customers / Overdue above the fold; entry bar sticky in the workflow, not buried.
4. Zero clutter: one accent colour, restrained borders, generous whitespace, progressive disclosure (click a customer for detail; reminder opens a modal).
5. Scan, don't read: status badges, big tabular numbers, F-pattern — totals top-left, then the table.
6. Instant feedback: toasts, skeletons and confirm dialogs for every destructive action.
7. Mobile-first for the counter: large touch targets, entry bar + voice button reachable with one thumb.
