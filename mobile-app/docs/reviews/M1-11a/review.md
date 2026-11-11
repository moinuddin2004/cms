# Review M1-11a — Patients types, API, keys, pure logic
Date: 2026-11-11 · Reviewer: architect (Claude Opus) with an independent reviewer agent · Verdict: **changes-requested** (small)
Branch: `mobile/M1-11a-patients-api` @ 0354cac · Commands (worktree F): tsc ✓ · jest 106 tests ✓ · ESLint 0 errors

Verified correct: every path and permission; `PatientDetail` has the same 40 fields as `PatientResponseDto`; all query names are on
the backend allow-list; `CreatePatientInput` is a correct subset; `patientAlerts` is a faithful port; keys carry org + location; `dob`
uses `todayYmd()`; no React.

## Findings (fix #1–#5)

| # | Sev | File:line | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | Medium | types/patients.types.ts:79–80 | Backend reads `isBlacklisted` / `isMinor` with `@Type(() => Boolean)`; axios sends `"false"`, which becomes `true` → `isMinor: false` returns only minors | Type both as `true` only (`isMinor?: true`) with a doc comment; test that the query builder never sends `false`. (Backend fix is a separate later card) |
| 2 | Medium | lib/mask-phone.ts:17–19 | 9-char input hides one digit; separators count toward length (`+92 •••4567`) | Mask on digits only (keep a leading `+`); 4 + 4 only when ≥ 4 digits stay hidden, else 2 + 2; add test rows |
| 3 | Low-Med | schemas/quick-register.schema.ts:6 | Phone regex accepts `"---"`, `"+"`; `\s` allows tabs/newlines | `^\+?[0-9][0-9 -]*$` + at least 7 digits; same for `guardianPhone` |
| 4 | Low → fix | quick-register.schema.ts:42–52 | Guardian fields pass through when not a minor | Transform drops them when `!isMinor`; assert in the test |
| 5 | Low → fix | quick-register.schema.ts:35 | `gender: ''` fails the enum | Map `''` → `undefined`; test row |
| 6 | Info | types/patients.types.ts:115–118 | Some appointment fields typed wider than the entity | Fine; note it |
| 7 | Info | patients.keys.ts:15 | `list` / `checkPhone` keys hold phone / search text | M1-06 / M1-11 must never allow-list them for persistence (card updated) |

## Answers
1. Keep `PrescriptionPage` separate (`{ data, total }`); S-05 sorts finalized/amended first, then drafts (do not hide drafts).
2. Vitals `[0]` is the latest (DESC). Decimal columns may arrive as strings — keep `number | string | null` for those.
