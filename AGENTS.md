# AGENTS Guide

## Current Structure

This project has been refactored into three main layers.

- `app/`
  - Page entrypoints and screen orchestration.
  - Pages should mainly keep routing, local UI state, data loading triggers, submit/delete handlers, and composition of smaller components.
  - Large screens are now partially split into section components and hooks.
- `lib/`
  - Pure calculation and transformation logic.
  - Examples: entry math, stock pricing, detail summaries, draft conversions.
  - If logic can be tested without React or Supabase, it should usually live here.
- `lib/repositories/`
  - Supabase access layer.
  - Query shape, insert/update/delete, signed URL generation, and row mapping belong here.
  - Pages should avoid calling `supabase.from(...).select(...)` directly when a repository function can own that behavior.

## Current Refactor Status

- Phase 1 is mostly complete:
  - fragile calculations and payload builders were moved into `lib/`
  - tests were added for those helpers
- Phase 2 is mostly complete:
  - major Supabase reads/writes were moved into `lib/repositories/`
- Phase 3 is largely complete:
  - major large pages were split into smaller UI sections
  - `tab-list` state and side effects were moved into `useTabList`
  - `tab-stock` and `tab-detail` detail/edit screens were split into smaller components

## Where New Code Should Go

- Add pure business logic to `lib/`
- Add Supabase queries and mutations to `lib/repositories/`
- Add presentational UI sections near the relevant page under `app/...`
- Add page-specific hooks near the page when state/effects become large
- Keep page files focused on wiring, not dense JSX or raw query details

## Feature Addition Flow

Use this as the default workflow for future feature work.

1. Check whether the change is mainly:
   - pure logic
   - repository/data access
   - UI/page behavior
2. Add or update a focused test first when the change affects business rules, calculations, payloads, or repository behavior.
3. Implement the feature in the proper layer:
   - `lib/` for logic
   - `lib/repositories/` for Supabase access
   - `app/` for UI composition and page behavior
4. Run targeted verification while working.
5. Before finishing, always run:
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm test`

## Practical Rules

- For calculation changes, prefer test-first in `lib/*.test.ts`
- For Supabase query/mutation changes, prefer test-first in `lib/repositories/*.test.ts`
- For simple UI-only changes, implementation can come first, but still finish with full verification
- Avoid adding new duplicated helpers inside page files if an existing `lib/` helper can own the logic
- Avoid adding new direct Supabase calls to pages unless there is a clear reason not to use a repository

## Current High-Value Entry Points

These areas are now good extension points for future work.

- `app/tab-list/useTabList.ts`
- `app/tab-stock/StockForm.tsx`
- `app/tab-complex/[id]/edit/*`
- `app/tab-detail/[id]/*`
- `app/tab-stock/[stockId]/*`
- `lib/repositories/*`
- `lib/*.ts`
