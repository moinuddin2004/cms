# Access Control & Clinic Customization — Acceptance Test Results

Run of `docs/access-control/test-cases.md` on branch `claude/ac-acceptance-ba8839` (based on `feat/access-control` @ 4db1ed4), 2026-10-22/23.

**How it was run**

- API cases: `backend/test/access/acceptance/*.int-spec.ts` (`npm run test:int:acceptance`), real Nest module graph and real guard chain on its own Neon schema `acceptit`; only the JWT check is swapped for an `x-test-user` header. A fresh world (section 0 fixtures) is seeded per spec file (`harness.ts` → `seedWorld`).
- UNIT: `backend/src/access/acceptance/guard.acceptance.spec.ts` (GRD-03, GRD-06, SEC-05; runs in the normal `npx jest`) and `web-app/src/features/access/acceptance/*.test.tsx` (THEME-09, THEME-15, UI-11).
- UI: Vitest + Testing Library under `web-app/src/features/access/acceptance/`, `/me/access` mocked per actor from the backend role templates (`actors.tsx`).
- Browser (REG-*, plus UI-01 and THEME-11 as extra evidence): API on :5100 against schema `acceptit`, web app on :3100; one screenshot set per case in `docs/access-control/screenshots/`. Test credentials are in `backend/test/access/acceptance/browser/browser-fixture.json` (localhost only).
- Redis was not available: realtime used the in-process bus; the `access.changed` socket test uses the real Socket.IO gateway.

**Totals: 166 cases — 163 pass, 3 fail, 0 blocked.**

| Section | Pass | Fail | Blocked |
| --- | --- | --- | --- |
| 1. Resolution & `/me/access` (AC-RES) | 13 | 0 | 0 |
| 2. Guard & decorators (AC-GRD) | 7 | 0 | 0 |
| 3. Feature entitlement (AC-FEAT) | 14 | 0 | 0 |
| 4. Roles & bundles (AC-ROLE) | 18 | 0 | 0 |
| 5. Scope: own / location / org (AC-SCOPE) | 11 | 0 | 0 |
| 6. Module permission checks (AC-MOD) | 38 | 3 | 0 |
| 7. Sidebar, nav builder, home redirect (AC-NAV) | 16 | 0 | 0 |
| 8. Theme & settings registry (AC-THEME) | 15 | 0 | 0 |
| 9. Realtime & cache invalidation (AC-RT) | 6 | 0 | 0 |
| 10. Security & tenant isolation (AC-SEC) | 7 | 0 | 0 |
| 11. UI gating (AC-UI) | 11 | 0 | 0 |
| 12. Regression smoke (AC-REG) | 7 | 0 | 0 |
| **All** | **163** | **3** | **0** |

## Results

### 1. Resolution & `/me/access` (AC-RES)

| ID | Result | Ran as | Note |
| --- | --- | --- | --- |
| RES-01 | pass | API 01-resolution |  |
| RES-02 | pass | API 01-resolution |  |
| RES-03 | pass | API 01-resolution |  |
| RES-04 | pass | API 01-resolution |  |
| RES-05 | pass | API 01-resolution |  |
| RES-06 | pass | API 01-resolution | NoPortalU: /me/access refused or empty, `/patients` → 403. |
| RES-07 | pass | API 01-resolution |  |
| RES-08 | pass | API 01-resolution |  |
| RES-09 | pass | API 01-resolution |  |
| RES-10 | pass | API 01-resolution |  |
| RES-11 | pass | API 01-resolution |  |
| RES-12 | pass | API 01-resolution |  |
| RES-13 | pass | API 01-resolution |  |

### 2. Guard & decorators (AC-GRD)

| ID | Result | Ran as | Note |
| --- | --- | --- | --- |
| GRD-01 | pass | API 02-guard |  |
| GRD-02 | pass | API 02-guard |  |
| GRD-03 | pass | UNIT backend |  |
| GRD-04 | pass | API 02-guard |  |
| GRD-05 | pass | API 02-guard |  |
| GRD-06 | pass | UNIT backend |  |
| GRD-07 | pass | API 02-guard |  |

### 3. Feature entitlement (AC-FEAT)

| ID | Result | Ran as | Note |
| --- | --- | --- | --- |
| FEAT-01 | pass | API 03-features |  |
| FEAT-02 | pass | API 03-features |  |
| FEAT-03 | pass | API 03-features |  |
| FEAT-04 | pass | API 03-features |  |
| FEAT-05 | pass | API 03-features |  |
| FEAT-06 | pass | API 03-features | The API refuses a past `until` (400 "must be in the future"), so an expired trial was produced by writing the past date in the DB: feature inactive, owner page shows `trial_expired`. |
| FEAT-07 | pass | API 03-features |  |
| FEAT-08 | pass | API 03-features | PUT {disabled:false} answers 200 as a no-op (it only records "disabled here"); the feature stays inactive at the location. Not refused with a 4xx. |
| FEAT-09 | pass | API 03-features |  |
| FEAT-10 | pass | API 03-features |  |
| FEAT-11 | pass | API 03-features |  |
| FEAT-12 | pass | API 03-features |  |
| FEAT-13 | pass | UI vitest | Vitest (page mounted with API mocked). Browser: /admin/features not driven. |
| FEAT-14 | pass | UI vitest |  |

### 4. Roles & bundles (AC-ROLE)

| ID | Result | Ran as | Note |
| --- | --- | --- | --- |
| ROLE-01 | pass | API 04-roles |  |
| ROLE-02 | pass | API 04-roles |  |
| ROLE-03 | pass | API 04-roles |  |
| ROLE-04 | pass | API 04-roles |  |
| ROLE-05 | pass | API 04-roles |  |
| ROLE-06 | pass | API 04-roles |  |
| ROLE-07 | pass | API 04-roles |  |
| ROLE-08 | pass | API 04-roles |  |
| ROLE-09 | pass | API 04-roles |  |
| ROLE-10 | pass | API 04-roles |  |
| ROLE-11 | pass | API 04-roles |  |
| ROLE-12 | pass | API 04-roles |  |
| ROLE-13 | pass | API 04-roles |  |
| ROLE-14 | pass | UI vitest |  |
| ROLE-15 | pass | UI vitest |  |
| ROLE-16 | pass | UI vitest |  |
| ROLE-17 | pass | UI vitest |  |
| ROLE-18 | pass | API 04-roles |  |

### 5. Scope: own / location / org (AC-SCOPE)

| ID | Result | Ran as | Note |
| --- | --- | --- | --- |
| SCOPE-01 | pass | API 05-scope |  |
| SCOPE-02 | pass | API 05-scope |  |
| SCOPE-03 | pass | API 05-scope |  |
| SCOPE-04 | pass | API 05-scope |  |
| SCOPE-05 | pass | API 05-scope |  |
| SCOPE-06 | pass | API 05-scope |  |
| SCOPE-07 | pass | API 05-scope |  |
| SCOPE-08 | pass | API 05-scope |  |
| SCOPE-09 | pass | API 05-scope |  |
| SCOPE-10 | pass | API 05-scope + UI vitest | API 403 + UI error state with retry. |
| SCOPE-11 | pass | API 05-scope |  |

### 6. Module permission checks (AC-MOD)

| ID | Result | Ran as | Note |
| --- | --- | --- | --- |
| MOD-01 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(billing.payment.collect) |
| MOD-02 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(billing.invoice.void) |
| MOD-03 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(billing.refund.issue) |
| MOD-04 | pass | API 06-modules | AdminU 200; RecU 403 with domain code BILLING_PRICE_CHANGE_NOT_ALLOWED (not NO_PERMISSION). |
| MOD-05 | pass | API 06-modules |  |
| MOD-06 | pass | API 06-modules | AdminU 201; RecU 403 BILLING_DISCOUNT_VALUE_NOT_ALLOWED (not NO_PERMISSION). |
| MOD-07 | pass | API 06-modules | allowed → 200, denied → 403 NO_PERMISSION(billing.cash_close) |
| MOD-08 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(expenses.manage) |
| MOD-09 | pass | API 06-modules | allowed → 200, denied → 403 NO_PERMISSION(earnings.own.view) |
| MOD-10 | pass | API 06-modules | allowed → 200, denied → 403 NO_PERMISSION(earnings.all.view) |
| MOD-11 | pass | API 06-modules | allowed → 200, denied → 403 NO_PERMISSION(compensation.manage) |
| MOD-12 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(appointments.book) |
| MOD-13 | pass | API 06-modules | allowed → 200, denied → 403 NO_PERMISSION(appointments.cancel) |
| MOD-14 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(queue.checkin) |
| MOD-15 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(queue.entry.manage) |
| MOD-16 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(queue.entry.reprioritize) |
| MOD-17 | pass | API 06-modules | allowed → 200, denied → 403 NO_PERMISSION(queue.doctor.own) |
| MOD-18 | fail | API 06-modules | FAIL — the Admin template has no `queue.doctor.any` (templates.ts NOT_FOR_ADMIN lists it), so AdminU gets 403 NO_PERMISSION(queue.doctor.any) on PATCH /queue/entries/:id/force-complete. Plan expects AdminU allowed. See bug B1. |
| MOD-19 | pass | API 06-modules | Doc2 on Doc1's encounter: 404 (scope reads as "not found"), not 403. Doc1: 200. |
| MOD-20 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(patients.clinical.edit) |
| MOD-21 | pass | API 06-modules |  |
| MOD-22 | fail | API 06-modules | FAIL — no patient export endpoint exists; `patients.export` is never enforced (GET /patients/export hits `:id` → 400). See bug B2. |
| MOD-23 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(prescriptions.create) |
| MOD-24 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(inventory.stock.adjust) |
| MOD-25 | pass | API 06-modules | allowed → 200, denied → 403 NO_PERMISSION(inventory.view) |
| MOD-26 | pass | API 06-modules | allowed → 201, denied → 403 NO_PERMISSION(lab.orders.create) |
| MOD-27 | pass | API 06-modules | allowed → 200, denied → 403 NO_PERMISSION(lab.billing.manage) |
| MOD-28 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(lab.catalog.manage) |
| MOD-29 | pass | API 06-modules | allowed → 200, denied → 403 NO_PERMISSION(lab.payables.manage) |
| MOD-30 | pass | API 06-modules | Doc1 403 ORDER_TEMPLATE_FORBIDDEN (service-level check), AdminU 201. |
| MOD-31 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(employees.manage) |
| MOD-32 | pass | API 06-modules | Needs `?month&year`; without them the endpoint 500s (bug B4). |
| MOD-33 | pass | API 06-modules | allowed → 404, denied → 403 NO_PERMISSION(leave.approve) |
| MOD-34 | pass | API 06-modules | allowed → 200, denied → 403 NO_PERMISSION(reports.export) |
| MOD-35 | pass | API 06-modules | allowed → 200, denied → 403 NO_PERMISSION(finance.overview.view) |
| MOD-36 | pass | API 06-modules | allowed → 400, denied → 403 NO_PERMISSION(notifications.settings.manage) |
| MOD-37 | pass | API 06-modules | AdminU 200 |
| MOD-38 | fail | API 06-modules | FAIL — RecU 403 NO_PERMISSION(admin.users.manage) ✓, but AdminU gets 403 "Only an owner can add another owner" (POST /user only creates owner / super_admin). See bug B3. |
| MOD-39 | pass | API 06-modules | AdminU 403; OwnerA 200 |
| MOD-40 | pass | API 06-modules | allowed → 200, denied → 403 NO_PERMISSION(admin.theme.manage) |
| MOD-41 | pass | API 06-modules | lab_admin 200; clinic AdminU/OwnerA refused by LabPortalGuard |

### 7. Sidebar, nav builder, home redirect (AC-NAV)

| ID | Result | Ran as | Note |
| --- | --- | --- | --- |
| NAV-01 | pass | UI vitest |  |
| NAV-02 | pass | UI vitest |  |
| NAV-03 | pass | UI vitest |  |
| NAV-04 | pass | API 07-nav |  |
| NAV-05 | pass | API 07-nav |  |
| NAV-06 | pass | API 07-nav |  |
| NAV-07 | pass | API 07-nav | the sidebar showing the code default is covered by the vitest NAV-* cases |
| NAV-08 | pass | UI vitest |  |
| NAV-09 | pass | UI vitest |  |
| NAV-10 | pass | UI vitest |  |
| NAV-11 | pass | UI vitest |  |
| NAV-12 | pass | UI vitest | State functions (drag reorder via moveNode/moveSection, rename, hide, add section) + page (Save disabled until dirty, reset ConfirmDialog, leave prompt). DnD gesture itself not simulated in jsdom. |
| NAV-13 | pass | UI vitest |  |
| NAV-14 | pass | UI vitest |  |
| NAV-15 | pass | UI vitest |  |
| NAV-16 | pass | UI vitest | Source checks + gate test; direct /dashboard stays (no redirect) — also seen in the browser (login → select location → /dashboard). |

### 8. Theme & settings registry (AC-THEME)

| ID | Result | Ran as | Note |
| --- | --- | --- | --- |
| THEME-01 | pass | API 08-theme |  |
| THEME-02 | pass | API 08-theme |  |
| THEME-03 | pass | API 08-theme |  |
| THEME-04 | pass | API 08-theme |  |
| THEME-05 | pass | API 08-theme |  |
| THEME-06 | pass | API 08-theme |  |
| THEME-07 | pass | API 08-theme |  |
| THEME-08 | pass | API 08-theme |  |
| THEME-09 | pass | UI vitest |  |
| THEME-10 | pass | UI vitest | Data attribute + the CSS rules for dark and brand are present; visual look not screenshotted. |
| THEME-11 | pass | UI vitest | Vitest + browser: fresh load of /login applied the clinic teal (screenshot THEME-11-login-themed.jpg). After an in-app sign-out (no reload) the login page shows the default blue — bug B8. [shot](screenshots/THEME-11-login-themed.jpg) |
| THEME-12 | pass | UI vitest |  |
| THEME-13 | pass | UI vitest |  |
| THEME-14 | pass | API 08-theme | print header read from GET /print/invoices/:id |
| THEME-15 | pass | UI vitest | 14 status-colour lines remain (appointments, employees, inventory, production, patient tabs); the only other hit is a warning comment in styles.css. |

### 9. Realtime & cache invalidation (AC-RT)

| ID | Result | Ran as | Note |
| --- | --- | --- | --- |
| RT-01 | pass | API 09-realtime |  |
| RT-02 | pass | API 09-realtime |  |
| RT-03 | pass | API 09-realtime |  |
| RT-04 | pass | UI vitest |  |
| RT-05 | pass | API 09-realtime |  |
| RT-06 | pass | UI vitest |  |

### 10. Security & tenant isolation (AC-SEC)

| ID | Result | Ran as | Note |
| --- | --- | --- | --- |
| SEC-01 | pass | API 10-security |  |
| SEC-02 | pass | API 10-security |  |
| SEC-03 | pass | API 10-security |  |
| SEC-04 | pass | API 10-security |  |
| SEC-05 | pass | UNIT backend |  |
| SEC-06 | pass | API 10-security | role cleared through the repository; the owner flag is independent of the assignment role |
| SEC-07 | pass | API 10-security |  |

### 11. UI gating (AC-UI)

| ID | Result | Ran as | Note |
| --- | --- | --- | --- |
| UI-01 | pass | UI vitest | Vitest + browser (Hygienist opening /payroll → NoAccess, screenshot UI-01-noaccess-payroll.jpg). [shot](screenshots/UI-01-noaccess-payroll.jpg) |
| UI-02 | pass | UI vitest |  |
| UI-03 | pass | UI vitest |  |
| UI-04 | pass | UI vitest |  |
| UI-05 | pass | UI vitest |  |
| UI-06 | pass | UI vitest |  |
| UI-07 | pass | UI vitest |  |
| UI-08 | pass | UI vitest |  |
| UI-09 | pass | UI vitest |  |
| UI-10 | pass | UI vitest |  |
| UI-11 | pass | UI vitest | Grep + review: every `size="icon"` control is a TooltipButton; every Switch and drag handle sits in a Tooltip; text-only radios/pills carry their own labels. |

### 12. Regression smoke (AC-REG)

| ID | Result | Ran as | Note |
| --- | --- | --- | --- |
| REG-01 | pass | browser | Owner: login → location select → /dashboard; sidebar has every clinic module (31 links, no super-admin-only ones). [shot](screenshots/REG-01a-select-location.jpg) [shot](screenshots/REG-01b-owner-home-sidebar.jpg) |
| REG-02 | pass | browser | Create patient → book → check in → call → start → treatment → complete visit, all in the UI. Needed fix e09930d (create-patient form sent blank optional fields; API refused). Test data: Doc1 needed a work schedule; fixture queue token counter corrected. [shot](screenshots/REG-02a-patient-booked-checked-in.jpg) [shot](screenshots/REG-02b-visit-completed.jpg) |
| REG-03 | pass | browser | Charge priced, Rs 3,000 cash collected, invoice + receipt issued, Print receipt fetched `/print/payments/:id` (200). Receipt header `logoUrl` = the theme logo (verified through the API after setting theme.logo_url). [shot](screenshots/REG-03-payment-received-receipt.jpg) |
| REG-04 | pass | browser | Draft saved, Submit to lab → "Order LAB-0001 sent to Regression Lab". Needed setup: a lab + service + link (API) and a service mapping (price list). [shot](screenshots/REG-04-lab-order-sent.jpg) |
| REG-05 | pass | browser | Reports hub → Profit & loss → Download → Excel: GET /reports/profit-loss/export → 200, "Excel file downloaded". [shot](screenshots/REG-05a-report-open.jpg) [shot](screenshots/REG-05b-report-exported.jpg) |
| REG-06 | pass | browser | Role "Hygienist" (Patients/Appointments/Queue = Basic) created and saved in the UI; employee created with that role + portal login (through the API — the Add Employee form refused the programmatic input); logged in as that employee: sidebar = Dashboard, Patients, Appointments only. [shot](screenshots/REG-06a-custom-role.jpg) [shot](screenshots/REG-06b-hygienist-home.jpg) |
| REG-07 | pass | browser | Teal saved in /admin/theme: `--brand`, `--primary`, buttons and `--ring` recoloured app-wide. [shot](screenshots/REG-07-theme-recolour.jpg) |

## Bugs and findings (not fixed — need a decision)

Plan cases that fail are bugs or plan/design mismatches. Nothing was changed to make a test pass.

**B1 — MOD-18: the Admin cannot run another doctor's queue (`queue.doctor.any`).**
`backend/src/access/catalog/templates.ts` removes `queue.doctor.any` (with `queue.doctor.own`, `consultation.conduct`, …) from the Admin template (`NOT_FOR_ADMIN`). The plan expects AdminU allowed; the web tests (`web-app/src/features/queue/test-access.tsx` `PERMS.admin`) also assume the Admin has it, and the force-complete button is gated by it.
Repro: seed a clinic, `AdminU` (Admin role) → `PATCH /queue/entries/<id>/force-complete` with `x-organization-id` / `x-location-id` → 403 `NO_PERMISSION`, `missing: ["queue.doctor.any"]`. Owner / super admin are fine.
Decision needed: add the key to the Admin template (one line), or change the plan. Left alone because the exclusion looks deliberate.

**B2 — MOD-22: `patients.export` is never enforced.**
The key is in the catalog (high risk), the Admin bundle and the roles screen, but no controller declares it and no export endpoint exists. Repro: `GET /patients/export` as AdminU or RecU → 400 (route falls into `GET /patients/:id`).
Decision needed: build the export (with `@Can('patients.export')` + audit) or drop the key.

**B3 — MOD-38: an Admin cannot create any user.**
`POST /user` accepts `type` `owner | super_admin` only; `UserService.createUser` refuses a non-owner adding an owner ("Only an owner can add another owner") and `employee` ("must be created from the Employee module"). So `admin.users.manage` lets the Admin through the gate but every create is refused. RecU → 403 `NO_PERMISSION(admin.users.manage)` works as planned.
Repro: AdminU (bearer token) → `POST /user {email,name,password,type:"owner"}` → 403 "Only an owner can add another owner".

**B4 — `GET /payroll/location` without `month` / `year` returns 500** (`parseInt(undefined)` → NaN reaches SQL). Pre-existing, not access related; should be a 400. Found by MOD-32 / XTRA-03.

**B5 — Encounters are not scoped to the doctor's own patients (security, found while reading the code; not a plan case).**
`GET /encounters/:id` is gated by `patients.clinical.view` (unscoped) and `POST /encounters/:encounterId/treatments` by `patients.clinical.edit` (unscoped); neither calls `assertConductScope` / `isPatientInScope`. Doc2 (patients.view = own) reads Doc1's encounter: 200 (XTRA-01); the treatment POST passes every access check and is only stopped by body validation (XTRA-02, 400). `PATCH /encounters/:id` and `/workspace` are correctly 404 for another doctor (MOD-19).
Repro: Doc1 and Doc2 each have an encounter; as Doc2 `GET /encounters/<Doc1's encounter id>` → 200 with Doc1's patient's notes.

**B6 — UI: dashboard asks for data the user may not see.** For a role without billing/finance (Hygienist), `/dashboard` fires `/invoices/stats` and `/financial-summary/{monthly,trend}` (several retries, all 403) and still shows "Revenue" and "Outstanding" cards as PKR 0 instead of hiding them.

**B7 — UI: after an in-app sign-out the login page shows the default blue theme** (no `/public/theme/:org` call) until the page is reloaded; a fresh load of `/login` is themed correctly (THEME-11).

**B8 — UI (not reproduced reliably): the Add Employee dialog showed "Please fix the errors below" with no field error and no request sent** when its fields were filled programmatically; the employee was created through the API instead (REG-06). Probably an artefact of how the fields were filled; worth a manual check.

### Plan vs implementation notes (cases marked pass)

- FEAT-06: the API rejects an `until` in the past (400), so "until = yesterday" cannot be sent; the expiry behaviour was verified with a past date written in the DB.
- FEAT-08: enabling a location override for an org-off feature answers 200 and changes nothing (no 4xx "refused").
- MOD-04 / MOD-06 / MOD-30: the denial is a domain error (`BILLING_PRICE_CHANGE_NOT_ALLOWED`, `BILLING_DISCOUNT_VALUE_NOT_ALLOWED`, `ORDER_TEMPLATE_FORBIDDEN`), 403 but not the generic `NO_PERMISSION` body.
- MOD-19, SCOPE-03: out-of-scope reads as 404 (allowed by the plan for SCOPE-03).
- GRD-06: besides `locations` and `user`, these `@ContextFree` handlers are exempt: `GET /me/access`, `GET /feature-flags/my-features`, `/me/notifications*`, `GET /order-links/:id`, and every `@LabPortalController` (guarded by `LabPortalGuard`).
- SEC-05: no handler uses `@Roles` any more; `legacyRolesFromPermissions` stays fail-closed.

## Fixes committed

| Commit | What |
| --- | --- |
| `e09930d` | `fix(patients)`: the create-patient form sent `''` for blank optional fields (`dob`, `email`, …); the API's `IsDateString` / `IsEmail` refused the whole request, so no patient could be registered from the UI without a date of birth and email. `createPatient` now drops blank fields. Found in REG-02, verified in the browser. |

Test tooling added (not product changes): the acceptance specs and harness, `npm run test:int:acceptance`, `jest-int-acceptance.json` (and `jest-int-access.json` now skips the acceptance folder), browser start scripts + two `.claude/launch.json` entries (`acceptance-api` :5100, `acceptance-web` :3100).

## Extra probes (not plan cases) — `11-extra.int-spec.ts`

| ID | Result | Note |
| --- | --- | --- |
| XTRA-01 | fail | Doc2 can read Doc1's encounter (200) — bug B5. |
| XTRA-02 | fail | Doc2's treatment POST on Doc1's encounter passes access checks (400 validation) — bug B5. |
| XTRA-03 | fail | `GET /payroll/location` with no params → 500 — bug B4. |

## Housekeeping

- All DB work used only schema `acceptit` (dropped at the end of the run); `public` and the shared `labs_it_*` / billing / tenancy schemas were not touched.
- The API process for the browser run used `search_path=acceptit,public`; it was started on :5100 and the web app on :3100, both stopped afterwards. The developer's :3000 server was not touched.
- `web-app/node_modules` in this worktree is a real copy (a junction to the main checkout broke Vite's nitro environment).

## Existing suites after the run

- `npx jest` (backend): 701 tests pass (698 before + GRD-03, GRD-06, SEC-05). One worker was killed by the OS (SIGTERM, machine overloaded) in the full run; that suite (`price-resolver`, 21 tests) passes when run alone.
- `npx vitest run` (web): 32 files, 325 tests pass (284 before + 41 acceptance tests).
- The acceptance API suite is not part of `npx jest`; run it with `npm run test:int:acceptance` (own schema `acceptit`, ~10 min per spec file on a loaded machine). Set `ACCEPT_IT_REUSE_SCHEMA=1` to keep the built schema between runs.

## Update — B1 and B5 fixed afterwards

| Commit | What | Verification |
| --- | --- | --- |
| `6699505` | `fix(access)`: the Admin template now holds `queue.doctor.any` (bug B1 / case MOD-18; it implies `queue.doctor.own`). Orgs whose roles were already seeded keep their stored Admin map — seeding is insert-missing — so an existing clinic needs its Admin role re-saved or a one-off update. | Unit test `MOD-18 (unit)`; `src/access`, `src/queue`, `src/employees` suites pass. **MOD-18 was not re-run through the API suite** (the fix is the template; expect pass). |
| `a42a34c` | `fix(encounters)`: `GET /encounters/:id` and `POST /encounters/:id/treatments` now check the caller's `patients.view` scope and answer 404 for another doctor's patient (bug B5). | Unit test (`encounter-patient-scope.spec.ts`). The DB probes XTRA-01 / XTRA-02 (+ new XTRA-01b: owner and Admin still get 200) were **not re-run**. |

Still open from B5's family: `POST /treatments` and `GET /treatments?patientId=` (patients.clinical.* without a patient-scope check) were not touched.
