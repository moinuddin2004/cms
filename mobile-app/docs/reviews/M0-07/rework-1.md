# Review M0-07 rework #1
Date: 2026-11-11 · Reviewer: architect (Claude Opus) · Verdict: **done** (dev-build check → gate M0-D)
Commits: 408487f + c3cd344 · Commands (worktree B): tsc ✓ · jest 33 tests ✓ · ESLint 0 errors

- #1 fixed: profiles use `"environment"`; RELEASE.md gives `eas env:set --name … --value … --environment … --visibility plaintext`
  per environment and a bold rule that every `eas update` passes the matching `--environment`. Verified against the Expo docs
  (environment-variables page): `env:set`, `eas update --environment` and the build-profile `environment` field all exist as used.
- #2 fixed: single `EAS_PROJECT_ID` constant (empty until `eas init`), `updates.url` and `extra.eas.projectId` derive from it.
- #3 fixed: `npx expo install expo-dev-client` listed for the user; "dev beside preview" left pending M0-D.
- #4 fixed: `appVersionSource: "remote"`, production `autoIncrement`.
- #5–#7 fixed (market:// intent + https fallback, `IOS_APP_STORE_URL` placeholder, module-level min-version promise with a RootShell test, no line numbers); `web.output` removed.

User action: `npx expo install expo-dev-client` (on mobile/develop after merge), then `eas init` and the `env:set` commands from RELEASE.md when ready.
