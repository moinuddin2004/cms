# Review M0-07 — app.config.ts, EAS, updates
Date: 2026-11-11 · Reviewer: architect (Claude Opus) with an independent reviewer agent; every Blocker verified by the architect · Verdict: **changes-requested**
Branch: `mobile/M0-07-eas` @ 2fd216d · Commands (worktree B): tsc ✓ · jest 8 suites / 32 tests ✓ · ESLint 0 errors · lint:fences ✓ · `expo config` for all three variants ✓

The code is good: every app.json field kept, variants exact, `runtimeVersion` = appVersion, the gate fails open and is
tested (numeric comparison, `v` prefix, suffixes), X-03 uses tokens only, channels correct, virtual mock removed,
shell imports clean, no secrets.

## Findings (fix #1–#4)

| # | Sev | File | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | **Blocker** | docs/RELEASE.md §4, eas.json | `eas update --environment <env>` reads **EAS-hosted** environment variables, not the build profiles' `env` blocks (verified: none are defined). The first OTA would bundle with `APP_VARIANT` unset and no `EXPO_PUBLIC_API_URL` → `core/env.ts` throws at start → every installed release build breaks | Move `APP_VARIANT` and `EXPO_PUBLIC_API_URL` to EAS environments: RELEASE.md gets `eas env:create` commands per environment (development / preview / production); build profiles use `"environment": "<name>"` instead of `env`; a bold warning that builds and updates must read the same environment |
| 2 | Major | app.config.ts:46–53, RELEASE.md §2 | Project id / updates URL come only from shell env, so EAS builds ship without them (updates disabled forever) | One `EAS_PROJECT_ID` constant (not a secret; placeholder until `eas init`), `updates.url` derived from it; remove the "or set env" option |
| 3 | Major | eas.json:7, HANDOFF | `developmentClient: true` but `expo-dev-client` is not installed; "dev beside preview" was ticked without a device | Put `npx expo install expo-dev-client` under install commands; mark that criterion pending gate M0-D |
| 4 | Minor → fix | eas.json:2 | `appVersionSource: local` with no versionCode → every AAB is versionCode 1; Play rejects the second upload | `"appVersionSource": "remote"` + `"autoIncrement": true` on production |
| 5 | Minor | src/shell/UpdateRequiredPage.tsx:22–42 | Opens the Play web page in a Custom Tab | `Linking.openURL('market://details?id=…')` with https fallback (store intents allowed — 03 §2 rule 10 updated) |
| 6 | Minor | src/shell/RootShell.tsx:35–48 | Check runs per mount (twice under StrictMode); no render test for the gated branch | Module-level promise; a test with mocked `fetchMinVersion` |
| 7 | Minor | app.config.ts, RELEASE.md | RELEASE.md cites line numbers | Refer to constant names |

## Answers to the handoff questions
- Drop `web.output: "server"`: yes (keep favicon).
- expo-doctor dependency drift: a separate chore on mobile/develop by the architect/user, not in feature branches.
- iOS store URL: add an `IOS_APP_STORE_URL` placeholder constant; decided with O-01 at M4.
