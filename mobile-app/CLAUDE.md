# CLAUDE.md — mobile-app

Expo SDK 58 / React Native app with **two isolated spaces in one binary**: a **staff** space (clinic
staff, existing backend API) and a **patient** space (patients + families, new `/patient-api`).
Backend: `../backend` (rules in the root `../CLAUDE.md`). Web: `../web-app`.

## Start here (every session)

1. [`docs/README.md`](docs/README.md) — doc map, workflow, golden rules.
2. [`docs/PROGRESS.md`](docs/PROGRESS.md) — what is `ready`; pick the first ready card whose deps are done.
3. Last 3 entries of [`docs/HANDOFF.md`](docs/HANDOFF.md).
4. Your card in [`docs/10-roadmap-and-tasks.md`](docs/10-roadmap-and-tasks.md) and every doc it lists.
5. [`AGENTS.md`](AGENTS.md) before touching any Expo / React Native API (SDK 58 docs, never memory).

Finish with the Definition of Done ([`docs/09`](docs/09-testing-and-quality.md#1-definition-of-done-every-task)),
a HANDOFF entry, and your PROGRESS row → `review`. Rules that fail a review: [`docs/03-security.md`](docs/03-security.md),
[`docs/04-coding-standards.md`](docs/04-coding-standards.md), checklist in [`docs/11`](docs/11-review-protocol.md).

## Non-negotiables (full list in docs)

- **Fences:** `src/core` imports neither space; `src/staff` ↔ `src/patient` never import each other;
  only `src/shell` sees both (via their `index.ts`). Lint-enforced; never `eslint-disable` them.
- **Routes** in `src/app/` contain zero logic — import one page/layout and render it.
- **Tokens:** access token in memory only; refresh token only in SecureStore (`auth.refreshToken` staff,
  `patient.refreshToken` patient). The patient client never sends `x-organization-id` / `x-location-id`.
- **PHI:** never in prefs MMKV, logs, toasts of errors, URLs or remote push text. Cached data only in the
  space's encrypted MMKV; sign-out of a space wipes it.
- **Forms:** TanStack Form + Zod 4 (react-hook-form banned), schema wired as `validators`, `fieldError(field)`,
  submit disabled on `!canSubmit || isSubmitting`; forms open in a bottom sheet / modal.
- **Data:** axios only in `api/<feature>.api.ts`; TanStack Query hooks; realtime only invalidates queries;
  queue mutations use `useIdempotentMutation` (`Idempotency-Key` per user intent, `If-Match` on entries).
- **States:** every list/detail has loading, empty, error (retry) and no-results; every action a pending state.
- **Time:** staff → `@/staff/lib/datetime` (active location tz); patient records → `formatInZone(v, record.timezone)`;
  dose reminders → phone wall-clock. Never `toLocale*String`, never `toISOString().slice(0,10)` for today.
- **Access:** `useAccess().can('perm')` — never role names.
- **Style:** theme tokens only (no hex), logical classes (`ms-/me-/ps-/pe-`, never `ml-/mr-`), safe-area utilities,
  `FlashList` for long lists, 44 pt targets, `accessibilityLabel` on every icon-only control.
- **UI:** no product name, no tooth-only icons (product name undecided; all clinic types).
- **Installs:** never run `npm install` / `npx expo install` — write the command in your handoff.
- **Generated code:** don't hand-edit `src/core/ui/*` (RNR CLI) except patches listed in `src/core/ui/PATCHES.md`;
  never hand-edit the access catalog (`npm run access:export` in `backend/`); never create `ios/`/`android/`.

## Commands

```bash
npm run dev          # expo start
npm run lint         # + npm run lint:fences after M0-02
npm run typecheck
npm test             # after M0-06
```

## Current state (2026-11-11)

Baseline only: staff email login, select location, session restore, access loading, placeholder home.
Code still lives in the pre-split layout (`src/features`, `src/lib`, `src/store`, `src/components`)
until card **M0-01** moves it into `src/core` / `src/staff` / `src/shell`. Native refresh-token flow:
`x-client-type: mobile` → refresh token in the body → SecureStore → `x-refresh-token`
(`backend/src/auth/native-client.ts`, honoured only without an `Origin` header).
