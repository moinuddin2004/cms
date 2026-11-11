# Review M2-12 — patient_app feature, permissions, settings keys
Date: 2026-11-11 · Reviewer: architect (Claude Opus) with an independent reviewer agent; Blocker verified by the architect · Verdict: **changes-requested** (root cause: the architect's card wording)
Branch: `mobile/M2-12-patient-app-keys` @ a62d9ab · Commands (worktree D): access, feature-flags, settings and coverage specs 15 suites / 149 tests ✓

Correct: feature seed (`enabledByDefault: false`, `patients.portal` still retired), both permissions on `patient_app`
with high risk, settings keys, the boot import works, both generated catalogs byte-identical to the source, no role names.

## Findings

| # | Sev | File:line | Finding | Required change |
| --- | --- | --- | --- | --- |
| 1 | **Blocker** | backend/src/access/catalog/bundles.ts:47 | `matchBundle` (bundles.ts:83) and the web `moduleLevel` only count grants in the bundle's own group (verified). A Patients permission inside the Queue bundle means Queue "Basic" can never match, `applyLevel('Queue','basic')` silently grants a high-risk Patients permission, and Queue "None" does not remove it. The card told you to do this — the card was wrong | Remove it from Queue; put `patients.app_link.manage: true` in the **Patients basic** bundle (full already gets it via `fullOf`). Remove `CROSS_MODULE_BUNDLE_GRANTS` and restore the strict "bundle group = permission group" test |
| 2 | Major | catalog.spec.ts:89–97, 245–252 | The test was loosened instead of catching #1 | Add: every bundle level round-trips `matchBundle(g, BUNDLES[g][l]) === l`, and basic ⊆ full per group |
| 3 | Minor | templates.ts | Only new orgs' Admin gets the permission (via Patients full); receptionists do not | Accepted on purpose: high-risk permission is opt-in. Record it in the handoff |
| 4 | Minor | access-templates.service.ts | Existing orgs' roles are not updated on deploy (insert-missing templates) | Accepted; record it |
| 5 | Minor | app.module.ts:67 | Settings side-effect import sits in app.module | Leave it for now; it moves into `PatientAppModule` after M2-01 is merged (noted for M2-02) |
