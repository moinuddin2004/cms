# Review M2-02 — Patient auth: email code, sessions, patient JWT, guard
Date: 2026-11-11 · Reviewer: architect (Claude Opus) with an independent security reviewer agent; finding 1 verified in `login-code.service.ts` · Verdict: **changes-requested** (one Major)
Branch: `mobile/M2-02-patient-auth` @ ff10682 (on top of M2-01) · Commands: 15 patient/coverage suites, 155 tests ✓ (reviewer); int spec not run (no disposable DB)

Verified correct: separate secret + boot checks; `aud: 'patient'`, 15 min, HS256 pinned; strategy ties `sid` to `sub`, requires a live
session and an active account; cross-space rejection tested both ways with real passport runs; refresh `<uuid>:<b64url32>`, sha256 +
`timingSafeEqual`, rotation by compare-and-swap, reuse revokes, 60-day sliding expiry; codes via `randomInt`, sha256(code + pepper),
10 min, single use; rate limits per 07 §5; no enumeration; explicit DTOs; guards; no patient ids in staff tables.

## Findings (fix #1, #2, #3, #6)

| # | Sev | File:line | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | **Major** | patient-auth/login-code.service.ts `verify()` | Attempt limit is check-then-act (read `attempts`, compare, then unconditional `increment`): N parallel requests each get a guess | Claim the attempt atomically: `UPDATE patient_login_codes SET attempts = attempts + 1 WHERE id = $1 AND attempts < 5 AND used_at IS NULL AND expires_at > now() RETURNING id`; no row → `CODE_INVALID`. Unit test with the update returning 0 rows |
| 2 | Minor → fix | login-code.service.ts | After the newest code is used, an older unexpired code becomes usable | `start()` invalidates earlier open codes for that email (set `used_at`), and success closes all open codes for the email |
| 3 | Minor → fix | dto/patient-auth.dto.ts | `termsVersion` / `privacyVersion` accept `''` | `@IsNotEmpty()` + `@Matches(/^[\w.-]{1,20}$/)` |
| 4 | Minor | mail-transport / mail.service (existing) | Recipient address appears in app logs on not-configured / failure paths (never the code) | Accepted as existing behaviour |
| 5 | Minor | patient-auth.service.ts `resolveAccount` | Identity insert `.orIgnore()` silently skips if an identity still points at a deleted account | M2-11 (account delete) must delete identities — card updated |
| 6 | Minor → fix | guard tests | No test that `PatientJwtGuard` sets `request.patientAuth` and leaves `request.user` unset | Add it (mocked strategy) |
| 7 | Decision | design | ~960 guesses/day/email with in-memory rate limits | Accepted for the pilot; DB-backed daily failed-verify cap logged as open risk R-01 in DECISIONS |
| 8 | Info | patient-session.service.ts | A client retrying a refresh with the old token after rotation is logged out (reuse detection) | Mobile patient client must single-flight refresh — already in 02 §5; noted on M2-06 |

Int spec: written, runs the change file after synchronize — still to be executed on a disposable Postgres.
