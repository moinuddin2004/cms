# Review M2-02 rework #1
Date: 2026-11-12 · Reviewer: architect (Claude Opus) · Verdict: **done**
Commits: 7176a89 + 148b972 · Commands: full backend jest 998 ✓

- #1 fixed: one atomic `UPDATE … SET attempts = attempts + 1 WHERE id AND attempts < 5 AND used_at IS NULL AND expires_at > now() RETURNING id`; no row → `CODE_INVALID`; unit test for the 0-row case.
- #2 fixed: `start()` closes earlier open codes; success closes all open codes for the email.
- #3 fixed: version strings `@IsNotEmpty` + pattern. #6 fixed: guard test proves `request.patientAuth` is set and `request.user` is not.
- #4, #5, #7, #8 recorded as accepted / carried (R-01, M2-11, M2-06).
- Int spec still not executed (needs a disposable Postgres).
