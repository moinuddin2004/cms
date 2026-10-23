# Access Control & Clinic Customization

How DentalFlow decides **who may do what** in each clinic, and how a clinic customises roles, features, its sidebar and its look.

Status: merged into `master` (eab1ddf, 2026-10-23). The acceptance plan passes 166/166 ([test-cases.md](test-cases.md), [test-results.md](test-results.md)). Design background lives in the "Clinic Customization & Access Control — Design" Claude Doc; where this README and that doc differ, **this README describes the code**.

---

## 1. Who controls what

| Level | Who | Decides | Cannot |
| --- | --- | --- | --- |
| Platform | Super admin | Which features each org is **entitled** to (optionally as a trial), platform default theme and theme locks. Can also do everything an owner can, in any org. | — (every change is audited as `actor_side = platform`) |
| Clinic | Owner, and staff whose role grants `admin.*` | Switch entitled features on/off, per-location feature overrides, roles and their permissions, sidebar layout, home page per role, theme, staff logins | Enable a feature that is not entitled; change a key the platform locked; grant more than they hold (no escalation) |
| Staff | Everyone else | Their own preferences (light/dark) | Their own access |

Owners and super admins always hold **every** permission of the features that are active for the org. Nobody can lock an owner out.

## 2. Concepts

| Concept | Defined in | Changed by |
| --- | --- | --- |
| **Feature** — a module switch (`billing.invoices`, `dental.lab_orders`, …) | `feature_catalog` (seeded from code) | Super admin entitles, owner enables |
| **Permission** — one action (`billing.invoice.void`) tied to one feature | `backend/src/access/catalog/permissions.ts` | Developers only |
| **Scope** — how far a permission reaches: `own`, `location`, `org` | Per permission (`scopes`) | Owner, per role |
| **Role** — a named map of permissions (+ home page) | `employment_roles` | Owner (system templates are read-only; clone them) |
| **Assignment** — an employee's role at one location | `employee_org_location_assignments` | Employee module |
| **Nav item** — a page and the permission it needs | `web-app/src/features/access/nav/nav.registry.ts` | Developers only |
| **Nav layout** — how the clinic arranges the sidebar | `nav_layouts` | Owner |
| **Setting** — a typed value with a cascade (theme today) | `backend/src/settings-registry/` registry, values in `config_values` | Super admin / owner |

Code never asks for a role name. It asks `can('permission')`.

## 3. How access is resolved

```
features  = catalog active ∧ entitled (trial not expired) ∧ enabled ∧ not disabled at this location
granted   = owner / super admin ? every permission (scoped ones at `org`)
          : role at this location (portal access on) + everything it `implies`
effective = granted, minus every permission whose feature is not in `features`
```

`AccessResolver` (`backend/src/access/access.resolver.ts`) builds an `AccessContext` once per **(user, org, location, `organizations.access_version`)** and caches it (5 min ceiling; the version check makes changes visible at once).

**Fail-closed.** A missing key means no access. A role holding only the old boolean keys (`canManageSettings`, `canConsult`, …) grants nothing. Old roles were deliberately **not** migrated.

**Change propagation.**
1. Writes to roles, assignments, org feature flags, ownership, nav layouts or location overrides bump `organizations.access_version`. This happens through the entity subscriber in `access/version/`, or explicitly where a DB cascade bypasses TypeORM.
2. The bump is published on Redis channel `dentalflow:access:changed`.
3. Every API instance and the worker drop their caches. The org version itself is cached for 15 s; without Redis that is the worst-case delay.
4. The Socket.IO gateway emits `access.changed { organizationId, version }` to room `org:<organizationId>` on namespace `/realtime`.
5. The web app (subscribed to that room) refetches `/me/access`. It also refetches on window focus once the data is older than 30 s.

## 4. Permission catalog

Every permission belongs to one feature. A permission is only effective while its feature is active. **High risk** permissions need a reason when granted in the roles screen, and the reason goes to `audit_logs`. "Implies" means granting the permission also grants those listed.

| Group | Permission | Feature | Scoped | Risk | Implies |
| --- | --- | --- | --- | --- | --- |
| Patients | `patients.view` | patients.core | ✓ | | |
| Patients | `patients.create` | patients.core | | | patients.view |
| Patients | `patients.edit` | patients.core | | | patients.view |
| Patients | `patients.delete` | patients.core | | high | patients.view |
| Patients | `patients.export` | patients.core | | high | patients.view |
| Patients | `patients.price.view` | patients.core | | | |
| Patients | `patients.clinical.view` | patients.core | | | |
| Patients | `patients.clinical.edit` | patients.core | | | patients.clinical.view |
| Patients | `patients.documents.manage` | patients.documents | | | |
| Patients | `patients.chart.edit` | patients.teeth_chart | | | patients.clinical.view |
| Patients | `plans.manage` | patients.treatment_plans | | | |
| Patients | `plans.templates.manage` | patients.treatment_plans | | | |
| Appointments | `appointments.view` | appointments.core | ✓ | | |
| Appointments | `appointments.book` | appointments.core | | | appointments.view |
| Appointments | `appointments.reschedule` | appointments.core | | | appointments.view |
| Appointments | `appointments.cancel` | appointments.core | | | appointments.view |
| Appointments | `appointments.override_rules` | appointments.core | | high | appointments.book |
| Queue | `queue.board.view` | appointments.core | | | |
| Queue | `queue.checkin` | appointments.core | | | queue.board.view |
| Queue | `queue.entry.manage` | appointments.core | | | queue.board.view |
| Queue | `queue.entry.reprioritize` | appointments.core | | | queue.board.view |
| Queue | `queue.doctor.own` | appointments.core | | | |
| Queue | `queue.doctor.any` | appointments.core | | | queue.doctor.own |
| Queue | `queue.display.manage` | appointments.core | | | |
| Consultation | `consultation.conduct` | patients.core | ✓ | | patients.clinical.edit |
| Consultation | `prescriptions.create` | patients.prescriptions | | | |
| Consultation | `prescriptions.library.manage` | patients.prescriptions | | | |
| Billing | `billing.desk.use` | billing.invoices | | | |
| Billing | `billing.invoice.view` | billing.invoices | ✓ | | |
| Billing | `billing.invoice.edit` | billing.invoices | | | billing.invoice.view |
| Billing | `billing.invoice.void` | billing.invoices | | high | billing.invoice.view |
| Billing | `billing.payment.collect` | billing.invoices | | | billing.invoice.view |
| Billing | `billing.refund.issue` | billing.invoices | | high | billing.invoice.view |
| Billing | `billing.price.override` | billing.invoices | | high | |
| Billing | `billing.cash_close` | billing.invoices | | | |
| Billing | `billing.activity.view` | billing.invoices | | | |
| Discounts | `billing.discount.apply` | billing.discounts | | | |
| Discounts | `billing.discount.custom` | billing.discounts | | high | billing.discount.apply |
| Expenses | `expenses.view` | billing.expenses | | | |
| Expenses | `expenses.manage` | billing.expenses | | | expenses.view |
| Commissions | `earnings.own.view` | billing.commissions | | | |
| Commissions | `earnings.all.view` | billing.commissions | | | earnings.own.view |
| Commissions | `compensation.manage` | billing.commissions | | high | earnings.all.view |
| Lab | `lab.orders.view` | dental.lab_orders | ✓ | | |
| Lab | `lab.orders.create` | dental.lab_orders | | | lab.orders.view |
| Lab | `lab.billing.manage` | dental.lab_orders | | | |
| Lab | `lab.catalog.manage` | dental.lab_orders | | | |
| Lab | `lab.payables.manage` | dental.lab_orders | | | |
| Lab | `lab.links.manage` | dental.lab_orders | | | |
| Lab | `lab.templates.share` | dental.lab_orders | | | |
| Inventory | `inventory.view` | inventory.core | | | |
| Inventory | `inventory.stock.adjust` | inventory.core | | | inventory.view |
| Inventory | `inventory.po.manage` | inventory.core | | | inventory.view |
| Team | `employees.view` | core (always on) | | | |
| Team | `employees.manage` | core | | | employees.view |
| Team | `payroll.manage` | hr.payroll | | high | |
| Team | `leave.approve` | hr.leave | | | |
| Reports | `reports.clinical.view` | reports.clinical | ✓ | | |
| Reports | `reports.financial.view` | reports.financial | ✓ | | |
| Reports | `reports.export` | reports.exports | | high | |
| Reports | `finance.overview.view` | reports.financial | | | |
| Admin | `admin.features.manage`, `admin.roles.manage`, `admin.users.manage`, `admin.nav.manage`, `admin.settings.manage`, `admin.locations.manage`, `admin.audit.view`, `admin.theme.manage`, `notifications.settings.manage` | core | | high on roles / users / features | |

The source of truth is `permissions.ts`. The web app imports the generated copy `web-app/src/features/access/generated/catalog.ts`, so `PermissionKey` is a typed union.

### What scopes mean

| Permission | `own` | `location` | `org` |
| --- | --- | --- | --- |
| `patients.view` | Patients with an appointment or a queue visit with this doctor | Registered, booked or queued at the active location | Every patient of the org |
| `appointments.view` | The doctor's own appointments | The active location | All |
| `consultation.conduct` | Only the doctor's own encounters | Location | All |
| `lab.orders.view` | Orders where the caller is the doctor or the creator | Location | All |
| `billing.invoice.view` | — | Location | All |
| `reports.*.view` | Doctor-filtered reports only (clinic overview answers 403) | Location | "All locations" toggle allowed |

Out-of-scope records answer **404**, the same as a record of another org, so their existence is not leaked. Patient-bound routes use `@PatientInScope()` (`backend/src/patients/access/patient-scope.ts`).

## 5. Bundles and system roles

**Bundles.** Each module (catalog group) offers three bundles, defined in `catalog/bundles.ts`:

| Bundle | What it grants |
| --- | --- |
| `none` | Nothing in that module |
| `basic` | Front-desk level (e.g. Billing: desk, invoice view at location, collect payment) |
| `full` | Every permission of the module at its widest scope |

The roles screen shows one None / Basic / Full control per module. "Advanced" opens the individual checkboxes and scope selects; a map that matches no bundle shows as **Custom**.

**System role templates.** Defined in `catalog/templates.ts` and seeded into every org on boot and on org creation. Seeding is insert-missing only.

| Template | Home page | In short |
| --- | --- | --- |
| Admin | `/dashboard` | Every module at full reach, incl. `queue.doctor.any` (run any doctor's queue). Leaves out the doctor-only keys `consultation.conduct`, `prescriptions.create`, `queue.doctor.own` (not stored, but implied by `queue.doctor.any` at runtime) and `earnings.own.view` |
| Doctor | `/queue/doctor` | Own patients and appointments, consult, prescriptions, own earnings, own lab orders, clinical reports (own) |
| Receptionist | `/appointments` | Patients at location, booking, check-in, queue board, billing desk + preset discounts, lab orders (view) |
| Assistant | `/appointments` | Patients at location, charting, booking, check-in, inventory view |
| Accountant | `/billing` | Invoices, voids, refunds, cash close, expenses, earnings, financial reports, lab billing / payables |

Template roles are read-only; **Clone** one to customise it.

## 6. Feature entitlement

- **Columns on `org_feature_flags`:** `is_entitled` (set by the super admin; column default `true`, so existing orgs kept their features), `entitled_until` (trial end), `entitled_by` / `entitled_at`, and `is_enabled` (the owner's switch).
- **Active feature:** catalog active ∧ entitled (and the trial has not expired) ∧ enabled. A missing row counts as entitled, with `enabled` taken from the catalog's `enabledByDefault`.
- **New orgs:** entitled only to the features that are on by default; the super admin entitles the rest.
- **Location overrides (`location_feature_overrides`):** can only switch an org-active feature **off** at one location, never on.
- **Owner page `/admin/features`:**
  - A feature that isn't entitled shows locked ("Plan mein nahi — super admin se rabta karein"); trying to change it returns 403 `NOT_ENTITLED`.
  - Turning a feature off first shows its impact: which permissions and roles stop working (`GET /admin/features/:key/impact`).
  - Permissions are **not deleted** from roles when a feature goes off; they come back when it is switched on again.
- **Super admin page `/organizations/$id/features`:** an Entitled and an Enabled switch per feature, a trial end date, and entitle / withdraw for a whole module.
- **Catalog seeding:** on boot it inserts missing keys only, so super-admin edits to the catalog survive restarts.

## 7. Roles admin (`/admin/roles`)

The server enforces these rules (`backend/src/employees/employment-roles.admin.controller.ts` and its service):

1. Every key must be in the catalog, and its scope must be one the permission allows. Otherwise 400.
2. **No escalation.** Unless they are an owner or super admin, a caller cannot grant a permission they lack, or a wider scope than they hold. The response is 403 `{ code: 'ESCALATION', permissions: [...] }`.
3. System template roles are read-only and cannot be deleted. Clone them instead.
4. A role that still has active members cannot be deleted. The response is 409 with the member count.
5. Granting a high-risk permission requires a `reason`.
6. Create, update, clone and delete each write an `audit_logs` row with the permissions before and after.
7. `home_route` must be an in-app path starting with `/`.

**Screens.**
- The list page has card and list views and filters.
- The detail page has three tabs:
  - **Permissions:** the module bundles plus Advanced. Features that are off are greyed with "feature band hai".
  - **Home page:** where members of this role land after login.
  - **Members:** who holds the role, per location.

The older `/employment-roles` endpoints still work. Reads need `employees.view`; writes need `admin.roles.manage`.

## 8. Staff logins

- **Where an employee's role comes from:** the role assignment at each location, set in the Employee module.
- **Creating a login.** A user with `admin.users.manage` can create one for an existing employee:
  - Call `POST /user` with `{ type: 'employee', employeeId, email, name, password }`.
  - The new user is linked to all of that employee's active assignments in the org, and portal access is turned on.
  - The response is 404 if the employee is not in the org, and 409 if the employee already has a login.
  - This grants **no permission by itself**: what the employee can do still comes from their role.
- **Picking the employee:** `GET /user/staff-candidates` lists employees with no login yet. The Users page form offers this as **Staff (existing employee)**.
- **Owner accounts:** only an owner or a super admin can create, edit or delete an owner account.
- **Super admins:** only a super admin can create another super admin.

## 9. Sidebar and home page

- **Pages** live in code: `NAV_ITEMS` in `nav.registry.ts`. Each page has its `can` permission, or a flag such as `superAdminOnly`, `ownerOrSuperAdmin` or `labMember`.
- **Arrangement** comes from data: the clinic layout in `nav_layouts` (`role_id = NULL` is the clinic default; v1 writes only that one). `/me/access` returns it as `nav`, or `null` for the code default `DEFAULT_NAV_LAYOUT`.
- **A layout never grants access.** Every item is still filtered by `can`, so a hidden permission stays hidden whatever the layout says.
- **Other layout rules:**
  - Unknown keys are ignored.
  - Pages the user can see that the layout leaves out go into a trailing **More** section.
  - Empty groups and sections are dropped.
- **Builder** at `/admin/navigation` (needs `admin.nav.manage`):
  - drag-and-drop reorder, rename (labels up to 40 chars), hide, add and remove sections and groups
  - live preview
  - "Reset to default", behind a confirm dialog
- **Server validation:** keys must match `nav.*`, no duplicates, at most 20 sections, no groups inside groups.
- **Home redirect.** The `/` route sends a user to:
  1. their role's `home_route`, else
  2. the layout's home page, else
  3. `/dashboard`.

  A home page is used only if the route exists and the user may see it. Opening `/dashboard` directly always works.

## 10. Theme and the settings registry

- **Storage:** `config_values` holds `scope_type` (`platform` / `org` / `location`), `scope_id`, `key`, `value`, `is_locked` and `version`.
- **Reading a value:** `SettingsRegistryService.get(key, { organizationId, locationId })` checks location, then org, then platform, then the code default. A value locked at a higher scope wins.
- **Writing a value:** each write is validated against the key's definition, refused if a higher scope locked the key, audited, and cache-invalidated through Redis.
- **Theme keys:**

  | Key | Scope | Values |
  | --- | --- | --- |
  | `theme.app_name` | org, location | text |
  | `theme.logo_url` | org, location | URL |
  | `theme.logo_dark_url` | org, location | URL |
  | `theme.favicon_url` | org | URL |
  | `theme.brand_color` | org | hex |
  | `theme.sidebar_style` | org | `light` / `dark` / `brand` |
  | `theme.default_mode` | org | `light` / `dark` / `system` |

- **Login page:** before sign-in, the app reads `GET /public/theme/:orgId`. The org comes from `?org=` or the last org used on that device. The response holds theme tokens only.
- **Signed in:** the app reads `GET /theme`.
- **Applying the theme:** `ThemeProvider` sets `--brand` and its shades on `:root`. The button text colour is picked by WCAG contrast. Brand-coloured UI must use `primary` tokens (`bg-primary`, `text-primary`, …), never `blue-*`.
- **Screens:** `/admin/theme` is the builder. Super admins also get a Platform default tab with per-key locks.
- **Printed documents:** billing prints use `theme.logo_url`, falling back to the old location logo.
- **Typed settings tables stay as they are:** `queue_policies`, `location_billing_settings`, `lab_billing_settings` and the others. The registry is for theme and new long-tail settings only.

## 11. Patient export

- **Endpoint:** `GET /patients/export` (`patients.export`) returns the filtered patient list as CSV.
- **Rows:** the same filters, sort and `patients.view` scope as `GET /patients`, but without paging. The file is capped at 10,000 rows, and the `X-Export-Truncated` header says when the cap was hit.
- **CSV format:**
  - starts with a UTF-8 BOM, so Excel shows Urdu names correctly
  - formula-like cells are neutralised (phone numbers such as `+92…` are kept as they are)
- **Audit:** every export writes an `audit_logs` row (`entity_type = patient_export`, `action = export`).
- **Screen:** the Patients page shows an **Export** button only to users with `patients.export`.

## 12. API reference

| Endpoint | Access |
| --- | --- |
| `GET /me/access` | Signed in. Org header required, location optional. Returns `{ version, organizationId, locationId, isSuperAdmin, isOwner, features, permissions, roles, employeeId, homeRoute, nav }` |
| `GET /me/catalog` | `admin.roles.manage` — permissions grouped by module, bundles, templates |
| `GET /admin/roles`, `GET /admin/roles/:id`, `POST /admin/roles`, `POST /admin/roles/:id/clone`, `PATCH /admin/roles/:id`, `DELETE /admin/roles/:id` | `admin.roles.manage` |
| `GET /employment-roles`, `GET /employment-roles/:id` | `employees.view` |
| `POST`, `PUT /:id`, `DELETE /:id` on `/employment-roles` | `admin.roles.manage` |
| `GET /admin/features`, `GET /admin/features/:key/impact`, `PATCH /admin/features/:key`, `PUT /admin/features/:key/locations/:locationId` | `admin.features.manage` |
| `GET /feature-flags/my-features` | Signed-in member of the org (location-aware) |
| `/feature-flags/catalog*`, `/feature-flags/org/:orgId*` (incl. `…/:key/entitlement`, `…/entitlement/bulk`, `…/seed`) | Super admin |
| `GET`, `PUT`, `DELETE /admin/navigation` | `admin.nav.manage` |
| `GET /public/theme/:organizationId` | Public (theme tokens only) |
| `GET /theme` | Any member |
| `GET`, `PUT /admin/theme`; `GET`, `PUT /admin/theme/location/:locationId` | `admin.theme.manage` |
| `GET`, `PUT /platform/theme` | Super admin |
| `GET /patients/export` | `patients.export` |
| `GET /user/staff-candidates`, `POST /user` (`type: employee`) | `admin.users.manage` (checked in the handler; super admins exempt) |

The permission of every other endpoint is on its controller. `@Can(...)` lists everything the endpoint needs.

## 13. Developer guide

**Protect an endpoint.** Every handler must carry one of these, or `backend/src/access/access-coverage.spec.ts` fails:

| Decorator | Use for |
| --- | --- |
| `@Can(...)` | A specific permission |
| `@AnyMember()` | Any member of the location |
| `@Public()` | No login. Also add the route to `auth/constants/public-routes.ts`, because `JwtAuthGuard` ignores `@Public()` |
| `@RequireSuperAdmin()` | Platform-only routes |
| `@ContextFree()` | Routes that check access themselves |

```ts
@Can('billing.invoice.void')            // all listed permissions required; class + method lists merge
@Post(':id/void')
void(@Param('id') id: string, @Access() access: AccessContext) { … }
```

A denial returns 403 `{ code: 'NO_PERMISSION', missing: [...] }`. `@Can` already implies the permission's feature; `@RequireFeature` is only needed on `@AnyMember` routes.

**Check inside a service.** Never use role names:

```ts
if (!access.can('billing.price.override')) throw noPermission(['billing.price.override']);
access.decide('billing.discount.apply', { value, min, max }); // 'allow' | 'deny' | 'needs_approval'
```

**Scope a query.**

```ts
access.applyScope(qb, 'appointments.view', { own: 'a.doctor_id', location: 'a.location_id' });
access.applyScope(qb, 'patients.view', patientScope('p.id')); // ownWhere / locationWhere predicates
```

No grant means no rows. Patient-bound routes add `@PatientInScope('id')`, or `('patientId', 'query')` for a query parameter.

**Hide a field.** Put `@VisibleIf('patients.price.view')` on a DTO class field. It only works on class instances.

**Add a permission.**
1. Add it to `permissions.ts` with its `feature`, `group`, `label`, and `scopes` / `implies` / `risk` where they apply.
2. Add it to the bundles and templates where it belongs.
3. Run `npm run access:export` in `backend/` to regenerate the web catalog.
4. Use it with `@Can` on the backend and `can()` on the frontend.

Existing orgs' template roles do **not** receive new keys automatically, because seeding is insert-missing. Owners must re-save those roles, or ship a one-off update.

**Frontend.**

```tsx
const { can, scope, hasFeature } = useAccess()        // @/features/access
<Can perm="billing.invoice.void"><VoidButton /></Can>  // or perm={[a, b]} = any of
export const Route = createFileRoute('/payroll')({ staticData: { can: 'payroll.manage' }, … })
```

The route check runs once in `__root.tsx` (`RouteAccessGate`): it shows a skeleton while loading, an error with retry on failure, and `NoAccess` when the user lacks the permission. Query hooks should take an `enabled` flag, so a screen never calls an API the user cannot use; the dashboard is the reference.

**Add a page to the sidebar.** Add a `nav.*` entry to `NAV_ITEMS` with its `can`, and place it in `DEFAULT_NAV_LAYOUT`. Clinic layouts that don't mention the page show it under "More".

**Add a setting.** Define it with `defineSetting(key, { …, scopes, lockable, default })` in `settings-registry`, and read it with `SettingsRegistryService.get`.

**Tests.**

| What | Command / file |
| --- | --- |
| Backend unit tests | `npm run test` |
| Frontend tests | `npm run test` in `web-app` |
| Endpoint coverage | `access-coverage.spec.ts` (part of the backend unit tests) |
| Acceptance (real DB) | `npm run test:int:acceptance`, on its own schema `acceptit`. Never run the shared `labs_it_*` / billing / tenancy suites in parallel |

## 14. Data model

| Table | What changed |
| --- | --- |
| `employment_roles` | `permissions` jsonb is `{ perm: 'own' \| 'location' \| 'org' \| true }`; + `template_key`, `home_route`, `description` |
| `organizations` | + `access_version` |
| `org_feature_flags` | + `is_entitled`, `entitled_until`, `entitled_by`, `entitled_at` |
| `location_feature_overrides` | new — `location_id`, `feature_key`, `is_disabled` |
| `nav_layouts` | new — `organization_id`, `role_id` (NULL = clinic default), `layout` jsonb, `version` |
| `config_values` | new — settings registry (theme) |
| `audit_logs` | used for roles, features, nav, theme, patient exports |

All schema comes from entities (`synchronize` in dev). There are no migration files and no data migration.

## 15. Going live

1. **Assign roles.** Every clinic owner assigns staff to the new roles (template or custom). Staff on old roles have **no** access until then.
2. **Re-save existing Admin roles.** Orgs seeded before 2026-10-23 keep their stored Admin map, which lacks `queue.doctor.any`.
3. **Production schema.** Run the reviewed schema sync (`npm run schema:sync:prod`), since `synchronize` is off there. See [../database-migrations.md](../database-migrations.md).
4. **Redis.** Redis must be reachable for instant cross-instance invalidation. Without it, changes take effect within 15 s (org version) to 30 s (feature flags).
5. **Browser check.** Not yet checked in a browser: the Export button, the staff option in the user form, the permission-gated dashboard, and the login theme after an in-app sign-out.

## 16. Not built yet (by decision)

- Plans and pricing tiers (`plans` table). Today the super admin entitles features one by one.
- Per-user overrides: grant or deny for one user, with expiry.
- A different sidebar layout per role. `nav_layouts.role_id` is reserved for this.
- Moving the typed settings tables into the registry.
- An approval UI. `decide()` can return `needs_approval`, but no flow consumes it.
- A "Preview as role" screen and a "Why can't I?" panel.
- Specialty presets and custom fields.

## Related docs

- [test-cases.md](test-cases.md): the acceptance plan (166 cases)
- [test-results.md](test-results.md): the run, the bugs found, and the fixes
- [../appointments-and-queue.md](../appointments-and-queue.md): queue and booking; §2 lists their permissions
- `CLAUDE.md`: the short developer rules for access control
