# Review M1-11a rework #1
Date: 2026-11-12 · Reviewer: architect (Claude Opus) · Verdict: **done**
Commits: 6abb4e5 + 14f5fa5 · Commands: tsc ✓ · jest 125 ✓ · ESLint 0 errors

- #1 fixed: query `isMinor` / `isBlacklisted` typed `true` only (never sends `"false"`).
- #2 fixed: masking on digits only, leading `+` kept, 4 + 4 only when ≥ 3 digits stay hidden, else 2 + 2. Minor: the doc comment says “≥ 12 digits” but the code uses ≥ 11 (an 11-digit local number shows 4 + 4 and hides 3) — fix the comment when next touched.
- #3 fixed: phone shape `^\+?[0-9][0-9 -]*$` + at least 7 digits (also guardian phone). #4 guardian fields dropped when not a minor. #5 `gender: ''` → undefined.
