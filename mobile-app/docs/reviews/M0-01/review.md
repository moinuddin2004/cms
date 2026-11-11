# Review M0-01 — Split source into core / staff / shell
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **done** (with a carry-over)
Branch: `mobile/M0-01-folder-split` @ 4924247 (+ 2eb06ec docs)
Commands run by reviewer: `tsc --noEmit` ✓ exit 0 · ESLint on `src` ✓ 0 errors, 3 warnings (all pre-existing kinds) · import greps ✓

## Findings

| # | Severity | File:line | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | Minor | `src/staff/lib/datetime.ts` (`inClinic`) | Re-implements `{ in: tz(zone) }` instead of reusing `inZone` from `@/core/datetime` | Use `inZone(zone)` next time this file is touched |
| 2 | Minor | `src/core/http/api-error.ts:5`, `src/staff/lib/api.ts:27` | `import/no-named-as-default-member` warnings (`axios.isAxiosError`, `axios.create`) | Switch to named imports when touching these files (M2-06 extracts the client factory anyway) |
| 3 | Minor | `components.json` | `hooks` alias points to `@/core/hooks`, which does not exist | Fine — create the folder when the first hook needs it |
| 4 | Process | shared working tree | M0-08's backend files sit uncommitted in this checkout (byte-identical to `mobile/M0-08-be-aud`) | Discard them from this checkout before the next task (see PROGRESS note) |

No blockers. No majors.

## Acceptance

- [x] lint + typecheck pass — re-run by reviewer.
- [~] App starts and login → select location → home → sign out unchanged — **not run** (no device/DB on the
      implementer's machine). Accepted on static evidence: route tree and provider tree unchanged, same
      QueryClient defaults, same refresh-token key and options, `staffApi` body identical to the old `api`.
      **Carry-over:** this smoke run is added to M0-04's acceptance (M0-04 must run on a device anyway).
- [x] Existing session survives — `createSecureItem('auth.refreshToken')` with the same keychain options.
- [x] Old folders gone; no `@/lib|@/store|@/features|@/components` imports (reviewer grep).
- [x] `core/` imports no space (reviewer grep).
- [x] `access:export` writes to the new path; generated catalog byte-identical.

## Answers to the implementer's questions

1. Static evidence is enough for this structural card; the runtime smoke moves to M0-04 (above).
2. Splitting M0-08 onto its own branch was correct (A-15). Thank you.
3. `@/core/hooks` — create on first use.

## Doc updates made in this review

- `10-roadmap-and-tasks.md` M0-04: acceptance gains the M0-01 smoke run.
- `PROGRESS.md`: M0-01 → done; parallel-work rule added (one checkout = one implementer at a time, or use `git worktree`).

## Notes for the next card

- `core/log.ts` does not exist yet; M0-02 adds `no-console`, so M0-02 creates `core/log.ts` (`debug` stripped in
  release via `__DEV__`, `error(name, code?, route?)` with no payloads).
