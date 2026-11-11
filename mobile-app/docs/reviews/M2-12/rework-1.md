# Review M2-12 rework #1
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **done**
Commits: 5ab22f3 + f63a8e8 · Commands (worktree D): access, feature-flags, settings specs 14 suites / 148 tests ✓

- #1 fixed: `patients.app_link.manage` moved to Patients basic; removed from Queue; `CROSS_MODULE_BUNDLE_GRANTS` gone; strict group test restored.
- #2 fixed: every bundle level round-trips through `matchBundle`; basic ⊆ full per group; a test pins the app-link permission to Patients basic.
- #3–#5 recorded in the handoff (opt-in high-risk permission; existing orgs unchanged on deploy; settings import moves into `PatientAppModule` after M2-01 merges).
- Both generated catalogs regenerated.
