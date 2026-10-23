# Access Control & Clinic Customization — Test Cases

Source of truth for the acceptance run of branch `feat/access-control`.
Design doc: https://claude.ai/artifact/R8tGmo11eqa8Sd5BEvtMoe ("Review ke baad faisle" wins over other sections).

Each case has an ID, the setup it needs, steps, and the expected result. **Type** says how to run it:

- `API`: integration test against a real Nest app + DB (supertest). Put these in `backend/test/access/acceptance/*.int-spec.ts`, using your own letter-only schema (e.g. `acceptit`). Never run the shared `labs_it_*` / billing / tenancy suites in full.
- `UNIT`: Jest or Vitest test without a DB.
- `UI`: a Vitest + Testing Library test where possible. Otherwise do a browser check against dev servers and record a screenshot.

Every failing case is a bug to report (or fix if trivial). Do not change the expected result to match the code.

---

## 0. Fixtures (build once, reuse)

| Name | What |
| --- | --- |
| `SA` | User with `global_role = super_admin` |
| `OrgA` | Organization; owner user `OwnerA` (row in `organization_ownership`) |
| `L1`, `L2` | Two locations of `OrgA` |
| `OrgB` | Second org with owner `OwnerB` and location `LB1`; used for tenant isolation |
| System roles in `OrgA` | Seeded templates: Admin, Doctor, Receptionist, Assistant, Accountant (`templates.ts`) |
| `AdminU` | Employee in `OrgA`, Admin role at `L1`, portal access on |
| `Doc1`, `Doc2` | Employees, Doctor role at `L1` (scope `own`) |
| `RecU` | Receptionist role at `L1` |
| `AsstU` | Assistant role at `L1` |
| `AcctU` | Accountant role at `L1` |
| `NoRoleU` | Employee at `L1` with portal access but `employment_role_id = NULL` |
| `LegacyU` | Role with only legacy keys `{ canManageSettings: true, canConsult: true }` (stored directly in the DB) |
| `NoPortalU` | Doctor role at `L1` but `has_portal_access = false` |
| `MultiU` | Receptionist at `L1` and Doctor at `L2` |
| Patients | `P1` has an appointment with `Doc1`; `P2` has an encounter with `Doc2` only; `P3` is at `L2` |

Unless a case says otherwise, all feature flags in `OrgA` are entitled + enabled.

---

## 1. Resolution & `/me/access` (AC-RES)

| ID | Scenario | Steps | Expected | Type |
| --- | --- | --- | --- | --- |
| RES-01 | Owner gets everything | `GET /me/access` as `OwnerA` with `x-organization-id=OrgA`, `x-location-id=L1` | 200. `isOwner=true`, every catalog key present, scoped keys = `org`, `features` = active keys | API |
| RES-02 | Super admin gets everything in any org | Same as `SA` against `OrgA` and against `OrgB` | 200 both. `isSuperAdmin=true`, all keys | API |
| RES-03 | Doctor template | As `Doc1` | `permissions` equals the Doctor template (e.g. `patients.view: own`, `consultation.conduct: own`, no `billing.*`). `homeRoute=/queue/doctor`. `employeeId` = Doc1 employee id | API |
| RES-04 | Fail-closed: no role | As `NoRoleU` | 200 with `permissions = {}` | API |
| RES-05 | Fail-closed: legacy-only role | As `LegacyU` | `permissions = {}`. Legacy keys give nothing (no data migration) | API |
| RES-06 | No portal access | As `NoPortalU` | `permissions = {}`. Any `@Can` endpoint returns 403 | API |
| RES-07 | `implies` expands | Role with only `billing.invoice.void` | `/me/access` also contains `billing.invoice.view` | API |
| RES-08 | Feature filter | Disable `billing.discounts` for OrgA, then `/me/access` as `RecU` | `billing.discount.apply` is absent; `billing.desk.use` is still present | API |
| RES-09 | Location-specific role | `MultiU` with `x-location-id=L1`, then `L2` | L1: receptionist keys. L2: doctor keys. No mixing | API |
| RES-10 | Missing org header | `/me/access` without `x-organization-id` | 400 | API |
| RES-11 | Foreign org | `RecU` calls with `x-organization-id=OrgB` | 403 | API |
| RES-12 | `nav` and `homeRoute` | Save a clinic nav layout (NAV-*), then `/me/access` | `nav` = saved layout; before saving it is `null` | API |
| RES-13 | Version number | Read `version`, change any role in OrgA, read again | `version` increased by ≥ 1 | API |

## 2. Guard & decorators (AC-GRD)

| ID | Scenario | Steps | Expected | Type |
| --- | --- | --- | --- | --- |
| GRD-01 | `@Can` allows | `RecU` → `POST` create patient | 201 | API |
| GRD-02 | `@Can` denies with body | `AsstU` → `POST /payroll/...` (any payroll write) | 403. Body `error.code = 'NO_PERMISSION'` and `missing` contains `payroll.manage` | API |
| GRD-03 | Class + method merge | Endpoint whose class needs A and method needs B; role has only B | 403, `missing` = [A] | UNIT |
| GRD-04 | `@AnyMember` | `NoRoleU` (member, no perms) → an `@AnyMember` endpoint (e.g. `GET /lab-links`) | 200. A non-member of the org gets 403 | API |
| GRD-05 | `@VisibleIf` strips field | Treatment/price response as `Doc1` (no `patients.price.view`) vs `RecU` | Price field absent for `Doc1`, present for `RecU` | API |
| GRD-06 | Every handler decorated | Reflect over all controllers in billing, queue, appointments, encounters, patients, prescriptions, plan-templates, treatments, inventory, lab-*, employees, payroll, reports, notifications, locations, user, access, feature-flags, settings-registry, nav | Each handler has `@Can`, `@AnyMember`, `@Public`, `@RequireSuperAdmin`, or is on the documented handler-checked exemption list (locations, user) | UNIT |
| GRD-07 | Owner bypass | `OwnerA` hits 5 random `@Can` endpoints across modules | All allowed | API |

## 3. Feature entitlement (AC-FEAT)

| ID | Scenario | Steps | Expected | Type |
| --- | --- | --- | --- | --- |
| FEAT-01 | Active = entitled ∧ enabled | Set `inventory.core` entitled=false, enabled=true | `/me/access` features lacks it; inventory endpoints return 403 even for the owner's staff; `OwnerA` also loses inventory permissions (feature filter applies to owners too) | API |
| FEAT-02 | Owner cannot enable an unentitled feature | `OwnerA` `PATCH /admin/features/inventory.core {enabled:true}` while not entitled | 403 `NOT_ENTITLED` | API |
| FEAT-03 | Owner toggles an entitled feature | Entitle it, then owner sets `enabled=false` and then `true` | Feature off then on; `access_version` bumps each time; an `audit_logs` row each time | API |
| FEAT-04 | SA entitlement endpoint | `SA` `PATCH /feature-flags/org/OrgA/<key>/entitlement {entitled:false}` | 200; the owner page shows the feature locked | API |
| FEAT-05 | Non-SA cannot entitle | `OwnerA` calls the entitlement endpoint | 403 | API |
| FEAT-06 | Trial expiry | Entitle with `until` = yesterday | Feature not active | API |
| FEAT-07 | Location override narrows | Owner disables `dental.lab_orders` for `L2` only | `/me/access` at L2 lacks the lab permissions; at L1 they remain | API |
| FEAT-08 | Location override cannot widen | Org feature off, try to enable it at a location | Refused | API |
| FEAT-09 | Impact list | `GET /admin/features/billing.discounts/impact` | Lists `billing.discount.apply` and `billing.discount.custom`, plus roles that grant them | API |
| FEAT-10 | Missing row default | Delete a flag row whose catalog `enabledByDefault=true` | Treated as entitled + enabled | API |
| FEAT-11 | Catalog reseed keeps SA edits | SA edits a catalog name, restart the app module | Edit survives; only missing keys are inserted | API |
| FEAT-12 | `my-features` membership | `RecU` calls `GET /feature-flags/my-features` with `x-organization-id=OrgB` | 403 (no cross-org leak) | API |
| FEAT-13 | Owner Features page UI | Render `/admin/features` with mixed entitled/locked data | Locked rows show "Plan mein nahi — super admin se rabta karein" and a disabled switch; turning a feature off opens the impact confirm | UI |
| FEAT-14 | SA two-switch page | Render `/organizations/$id/features` | Entitled + Enabled switches per feature, trial DatePicker, bulk by module | UI |

## 4. Roles & bundles (AC-ROLE)

| ID | Scenario | Steps | Expected | Type |
| --- | --- | --- | --- | --- |
| ROLE-01 | List roles | `AdminU` `GET /admin/roles` | 5 system roles + custom ones; each with member count and per-module bundle match | API |
| ROLE-02 | Create custom role | `POST /admin/roles` with name "Nurse" and a valid permission map | 201; usable in an employee assignment | API |
| ROLE-03 | Unknown key rejected | Permissions contain `foo.bar` | 400 | API |
| ROLE-04 | Invalid scope rejected | `billing.desk.use: 'own'` (unscoped key) or `patients.view: 'galaxy'` | 400 | API |
| ROLE-05 | No escalation | A custom role holder with `admin.roles.manage` but no `billing.invoice.void` grants `billing.invoice.void` to a role | 403 `ESCALATION` listing that key | API |
| ROLE-06 | No scope escalation | Actor has `patients.view: location` and grants `patients.view: org` | 403 `ESCALATION` | API |
| ROLE-07 | Owner bypasses escalation | `OwnerA` grants anything | 200 | API |
| ROLE-08 | System role read-only | PATCH or DELETE on the Admin template | Refused (4xx); clone works and the clone is editable | API |
| ROLE-09 | Delete role with members | DELETE the Receptionist clone that `RecU` uses | 409 with member count | API |
| ROLE-10 | High-risk needs reason | Grant `billing.refund.issue` without `reason` | 400; with `reason` → 200 and the reason is stored in the audit row | API |
| ROLE-11 | Audit | Create, update, clone, delete | One `audit_logs` row each, with before/after permissions | API |
| ROLE-12 | Role edit bumps version | PATCH a role in use | `access_version` +1; `RecU`'s next `/me/access` reflects it; a realtime `access.changed` is emitted to room `org:<OrgA>` | API |
| ROLE-13 | `home_route` validation | `homeRoute: 'https://evil.com'` or `'dashboard'` | 400 | API |
| ROLE-14 | Bundle control round trip | In role detail, set Billing = Basic, then Full, then None | Permission map equals `BUNDLES.Billing.<level>`; toggling one Advanced checkbox shows "Custom" | UI |
| ROLE-15 | System role UI read-only | Open the Admin role detail | Controls disabled; "Clone to edit" CTA visible | UI |
| ROLE-16 | Feature-off permissions greyed | Feature off → open a role | Its permissions are greyed with "feature band hai" | UI |
| ROLE-17 | Escalation error shown | Mock a 403 ESCALATION on save | Error lists the keys; unsaved changes are kept | UI |
| ROLE-18 | Old employment-roles API | `/employment-roles` CRUD still works but needs `admin.roles.manage` | `RecU` gets 403; `AdminU` gets 200 | API |

## 5. Scope: own / location / org (AC-SCOPE)

| ID | Scenario | Steps | Expected | Type |
| --- | --- | --- | --- | --- |
| SCOPE-01 | Patients `own` | `Doc1` lists patients | Sees `P1` (appointment with Doc1); not `P2`, not `P3` | API |
| SCOPE-02 | Patients `own` via encounter | `Doc2` lists patients | Sees `P2` | API |
| SCOPE-03 | Out-of-scope detail | `Doc1` `GET` patient `P2` | 404 (or 403); no data leak | API |
| SCOPE-04 | Patients `location` | `RecU` (L1) lists | Sees L1 patients only, not `P3` | API |
| SCOPE-05 | Patients `org` | `AdminU` lists | Sees all OrgA patients, none of OrgB | API |
| SCOPE-06 | Appointments `own` | `Doc1` lists appointments | Only Doc1's | API |
| SCOPE-07 | Lab orders `own` | `Doc1` lists lab orders | Only orders where Doc1 is the doctor or creator; another doctor's order detail → 404 | API |
| SCOPE-08 | Invoices `location` | `AcctU` (L1) lists invoices | L1 only | API |
| SCOPE-09 | Reports cross-location | `AcctU` (`reports.financial.view: location`) asks for "all locations" | Refused or limited to L1; `AdminU` (org) gets all locations | API |
| SCOPE-10 | Clinic overview with `own` | `Doc1` opens clinic overview | 403; page shows its error state | API/UI |
| SCOPE-11 | No grant → no rows | Role without `patients.view` hits list | 403 (guard) | API |

## 6. Module permission checks (AC-MOD)

For each row: one allowed actor and one denied actor. Expected: allowed → 2xx, denied → 403 `NO_PERMISSION` with the listed key in `missing`.

| ID | Module / action | Endpoint (look up exact path in controller) | Allowed | Denied | Key |
| --- | --- | --- | --- | --- | --- |
| MOD-01 | Billing desk collect | collect/charge payment | `RecU` | `AsstU` | `billing.payment.collect` |
| MOD-02 | Invoice void | void invoice | `AcctU` | `RecU` | `billing.invoice.void` |
| MOD-03 | Refund | issue refund | `AcctU` | `RecU` | `billing.refund.issue` |
| MOD-04 | Price override | edit charge price | `AdminU` | `RecU` | `billing.price.override` |
| MOD-05 | Preset discount in range | apply discount type within min/max | `RecU` | `AsstU` | `billing.discount.apply` |
| MOD-06 | Discount out of range | apply value > max | `AdminU` (has custom) → allow | `RecU` → deny (or `needs_approval` if the clinic approval flow is on) | `billing.discount.custom` |
| MOD-07 | Cash close | cash close | `AcctU` | `RecU` | `billing.cash_close` |
| MOD-08 | Expenses write | create expense | `AcctU` | `RecU` | `expenses.manage` |
| MOD-09 | Own earnings | my earnings | `Doc1` | `RecU` | `earnings.own.view` |
| MOD-10 | All doctor earnings | doctor earnings report | `AcctU` | `Doc1` | `earnings.all.view` |
| MOD-11 | Compensation plans | create/edit plan | `AdminU` | `AcctU` | `compensation.manage` |
| MOD-12 | Book appointment | create appointment | `RecU` | `Doc1` | `appointments.book` |
| MOD-13 | Cancel appointment | cancel | `RecU` | `AsstU` | `appointments.cancel` |
| MOD-14 | Check-in | queue check-in | `RecU` | `Doc1` | `queue.checkin` |
| MOD-15 | Queue skip/remove | entry manage | `RecU` | `AsstU` | `queue.entry.manage` |
| MOD-16 | Reprioritize | change priority | `AdminU` | `RecU` | `queue.entry.reprioritize` |
| MOD-17 | Own doctor queue | doctor screen own | `Doc1` | `RecU` | `queue.doctor.own` |
| MOD-18 | Other doctor's queue | open Doc2 queue | `AdminU` | `Doc1` | `queue.doctor.any` |
| MOD-19 | Consultation own | act on Doc1's encounter | `Doc1` | `Doc2` (not own) | `consultation.conduct` (own) |
| MOD-20 | Clinical note edit | edit clinical note | `Doc1` | `RecU` | `patients.clinical.edit` |
| MOD-21 | Patient delete | delete | `AdminU` | `RecU` | `patients.delete` |
| MOD-22 | Patient export | export | `AdminU` | `RecU` | `patients.export` |
| MOD-23 | Prescription create | create | `Doc1` | `RecU` | `prescriptions.create` |
| MOD-24 | Inventory stock adjust | adjust | `AdminU` | `AsstU` (view only) | `inventory.stock.adjust` |
| MOD-25 | Inventory view | list items | `AsstU` | `RecU` | `inventory.view` |
| MOD-26 | Lab order create | create order | `Doc1` | `RecU` | `lab.orders.create` |
| MOD-27 | Lab billing | lab invoice list | `AcctU` | `Doc1` | `lab.billing.manage` |
| MOD-28 | Lab catalog | clinic price list write | `AdminU` | `AcctU` | `lab.catalog.manage` |
| MOD-29 | Lab payables | vendor bill | `AcctU` | `RecU` | `lab.payables.manage` |
| MOD-30 | Lab template share | share template | `AdminU` | `Doc1` | `lab.templates.share` |
| MOD-31 | Employees write | create employee | `AdminU` | `AcctU` | `employees.manage` |
| MOD-32 | Payroll | payroll list | `AdminU` | `AcctU` | `payroll.manage` |
| MOD-33 | Leave | approve leave | `AdminU` | `RecU` | `leave.approve` |
| MOD-34 | Report export | export a financial report | `AcctU` | `Doc1` | `reports.export` |
| MOD-35 | Finance overview | finance dashboard | `AcctU` | `RecU` | `finance.overview.view` |
| MOD-36 | Notification settings | update rule | `AdminU` | `RecU` | `notifications.settings.manage` |
| MOD-37 | Locations admin | update location settings (no tenant headers) | `AdminU` | `RecU` | `admin.locations.manage` |
| MOD-38 | Users admin | create user | `AdminU` | `RecU` | `admin.users.manage` |
| MOD-39 | Owner account protection | `AdminU` (not owner) edits `OwnerA`'s user | Refused; `OwnerA` can do it | — |
| MOD-40 | Theme admin | `PUT /admin/theme` | `AdminU`/`OwnerA` | `RecU` | `admin.theme.manage` (or CLINIC_ADMIN until wave 3) |
| MOD-41 | Lab portal untouched | lab staff (`lab_admin`) endpoints | Still governed by `LabPortalGuard`; clinic roles irrelevant | — | — |

## 7. Sidebar, nav builder, home redirect (AC-NAV)

| ID | Scenario | Steps | Expected | Type |
| --- | --- | --- | --- | --- |
| NAV-01 | Default sidebar per role | Render the Sidebar with `Doc1`, `RecU`, `AcctU`, owner access | Each shows only items whose `can` passes; empty groups and sections hidden; "Clinic setup" only for admin/owner | UI |
| NAV-02 | Super-admin-only items | Non-SA owner | Organizations / Lab Directory / Config Studio hidden; visible for SA | UI |
| NAV-03 | Lab portal item | User with `labMemberships` | Lab portal item visible | UI |
| NAV-04 | Save layout | `PUT /admin/navigation` with renamed "Billing desk" → "Cash counter", hidden item, reordered sections | 200; `/me/access.nav` returns it; `audit_logs` row; `access_version` +1 | API |
| NAV-05 | Layout validation | Bad key `foo`, duplicate key, label > 40 chars, > 20 sections, nested groups, external home route | 400 for each | API |
| NAV-06 | Saving the same layout again | PUT identical JSON twice | Second call: no new audit row, no version bump | API |
| NAV-07 | Reset | `DELETE /admin/navigation` | `/me/access.nav` = null; sidebar shows the code default | API |
| NAV-08 | Layout never grants | Layout includes `nav.payroll`, user lacks `payroll.manage` | Item not shown; direct URL shows NoAccess | UI |
| NAV-09 | Unknown keys ignored | Server layout contains `nav.ghost` | No crash; ignored | UI |
| NAV-10 | Missing items go to "More" | Layout omits a page the user can see | Appears under "More" | UI |
| NAV-11 | Renamed label everywhere | After rename | Sidebar, collapsed tooltip and active link use the new label | UI |
| NAV-12 | Builder | `/admin/navigation`: drag reorder, rename, hide, add section, reset | Saved JSON matches; Save disabled until dirty; leave-without-saving prompt; reset behind a ConfirmDialog | UI |
| NAV-13 | Builder access | `RecU` opens `/admin/navigation` | NoAccess page | UI |
| NAV-14 | Home redirect | `Doc1` logs in / visits `/` | Lands on `/queue/doctor` | UI |
| NAV-15 | Home redirect fallback | Role home = a page the user can't see | Lands on `/dashboard` | UI |
| NAV-16 | Direct `/dashboard` | Visit `/dashboard` | Stays on dashboard (no forced redirect) | UI |

## 8. Theme & settings registry (AC-THEME)

| ID | Scenario | Steps | Expected | Type |
| --- | --- | --- | --- | --- |
| THEME-01 | Cascade | Set platform `theme.brand_color`, then org, then (where allowed) location values | `get` returns location → org → platform → code default, in that order | API |
| THEME-02 | Lock | SA locks `theme.brand_color` at platform; owner PUTs a new colour | Refused; effective value = platform | API |
| THEME-03 | Validation | Invalid hex, unknown `sidebar_style`, non-URL logo | 400 | API |
| THEME-04 | Public theme | `GET /public/theme/OrgA` with no auth | 200 with ONLY `theme.*` tokens (no other org data) | API |
| THEME-05 | Public theme unknown org | Random uuid | Code defaults or 404; no 500 | API |
| THEME-06 | Audit + version | Owner saves the theme | `audit_logs` row; `version` increments on `config_values` | API |
| THEME-07 | Location override | `PUT /admin/theme/location/L2` with name + logo | L2 users see the L2 name/logo; L1 sees the org one | API |
| THEME-08 | Platform endpoints | `OwnerA` → `PUT /platform/theme` | 403; `SA` → 200 | API |
| THEME-09 | CSS variables | Render ThemeProvider with brand `#0d9488` | `--brand`, `--brand-hover`, `--brand-soft`, `--brand-text` set; `--primary-foreground` chosen by WCAG contrast (black for this teal) | UNIT |
| THEME-10 | Sidebar style | `sidebar_style = dark` / `brand` | Sidebar has the data attribute and the dark/brand look | UI |
| THEME-11 | Login page theme | Remembered last org → `/login` | Brand colour, name and logo applied before sign-in | UI |
| THEME-12 | Default mode | Clinic `default_mode = dark`, user has no saved preference | Starts in dark; a saved user preference wins | UI |
| THEME-13 | Builder | `/admin/theme`: change colour → contrast warning for a too-light colour; Save disabled until dirty; Reset to default | As described | UI |
| THEME-14 | Print logo | Billing print data for an org with `theme.logo_url` | Uses the theme logo; falls back to the old location logo when unset | API |
| THEME-15 | Brand tokens used | Grep `web-app/src` for `(bg|text|border|ring)-(blue|indigo)-[0-9]{3}` | Only the 14 documented status uses remain | UNIT |

## 9. Realtime & cache invalidation (AC-RT)

| ID | Scenario | Steps | Expected | Type |
| --- | --- | --- | --- | --- |
| RT-01 | Version bump triggers | Change: role permissions, assignment role, assignment active/portal, org feature flag, location override, ownership, nav layout | Each bumps `organizations.access_version` | API |
| RT-02 | Socket room | Connect to `/realtime` as `RecU`, `subscribe {room:'org:<OrgA>'}` | Ack OK; a user of `OrgB` is refused that room | API |
| RT-03 | Event | Change a role after subscribing | `access.changed {organizationId, version}` received | API |
| RT-04 | Frontend refetch | Simulate the event in UI | `['access','me',org,loc]` refetched; an older version is ignored | UI |
| RT-05 | Cache keyed by version | Change a role, then immediately call a `@Can` endpoint | New permissions apply (no stale allow/deny) | API |
| RT-06 | Query key includes org | Switch location/org in UI | Access query key changes; no cross-org reuse | UI |

## 10. Security & tenant isolation (AC-SEC)

| ID | Scenario | Steps | Expected | Type |
| --- | --- | --- | --- | --- |
| SEC-01 | Cross-tenant | `AdminU` (OrgA) calls a few OrgA-allowed endpoints with `x-organization-id=OrgB` | 403 | API |
| SEC-02 | Header spoof location | `RecU` with `x-location-id=L2` (no assignment there) | 403 or empty permissions | API |
| SEC-03 | Deactivated employee | Set the assignment `is_active=false` | Next request: no permissions (version bump) | API |
| SEC-04 | Removed ownership | Remove `OwnerA` ownership | Loses owner bypass on the next request | API |
| SEC-05 | Legacy `@Roles` derive | Endpoints still on `@Roles` (if any remain) | `RecU` (has `appointments.book`) passes RECEPTIONIST; `NoRoleU` fails | API |
| SEC-06 | Owner lockout impossible | Owner edits their own assignment role to nothing | Owner still has full access | API |
| SEC-07 | Commission doctor detection | Compensation plan for an employee whose role grants `consultation.conduct` vs not | Only the doctor role is treated as a doctor (old `canConsult` ignored) | API |

## 11. UI gating (AC-UI)

| ID | Scenario | Steps | Expected | Type |
| --- | --- | --- | --- | --- |
| UI-01 | Route gate | `RecU` opens `/payroll`, `/finance`, `/admin/roles` | NoAccess page (not a blank screen, not a crash) | UI |
| UI-02 | Route gate loading | While `/me/access` is loading | LoadingSkeleton | UI |
| UI-03 | Route gate error | `/me/access` 500 | Error state with retry | UI |
| UI-04 | Buttons hidden | `RecU` on an invoice detail | Void / refund buttons hidden; collect visible | UI |
| UI-05 | Discount sheet | `RecU`: values outside the range not allowed; `AdminU`: allowed | As described | UI |
| UI-06 | Queue actions | `Doc1` on the queue board: no reprioritize; `AdminU`: has it | As described | UI |
| UI-07 | Patient tabs | `Doc1`: no billing tab; `RecU`: billing tab | As described | UI |
| UI-08 | Lab template share | `Doc1`: no share action; `AdminU`: share | As described | UI |
| UI-09 | Settings links | `RecU`: no Billing / Notifications / Theme links; `AdminU`: all | As described | UI |
| UI-10 | Users page | `RecU` → `/users` | NoAccess; `AdminU` → page | UI |
| UI-11 | Icon buttons have tooltips | New admin screens (roles, features, navigation, theme) | Every icon-only button uses `TooltipButton` / Tooltip | UNIT (grep + review) |

## 12. Regression smoke (AC-REG)

Run as `OwnerA` in a browser against the dev servers. Record a screenshot for each.

| ID | Flow | Expected |
| --- | --- | --- |
| REG-01 | Login → location select → home | Lands correctly; sidebar shows all modules |
| REG-02 | Create patient → book appointment → check in → doctor starts consultation → complete | Works end to end |
| REG-03 | Billing desk: collect payment, print receipt | Works; receipt uses the theme logo |
| REG-04 | Lab order create → send | Works |
| REG-05 | Reports hub → open + export one report | Works |
| REG-06 | Create a custom role, assign it to an employee, log in as that employee | That employee sees exactly the role's pages |
| REG-07 | Change the theme colour | Whole app recolours, including buttons and focus rings |

---

## Reporting

Write results to `docs/access-control/test-results.md`:

- A table with ID | Result (pass / fail / blocked) | Note (error message, file:line, screenshot path).
- A short list of bugs, each with exact repro steps.
- Totals per section.
