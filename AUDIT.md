# AUDIT.md — Existing Feature Health Report

**Date:** 2026-06-10
**Auditor:** Automated production-readiness audit
**Scope:** All existing modules in `cms/backend/src/` and `cms/web-app/src/`

---

## App Bootstrap & Global Configuration

### main.ts
- **Double DataSource Init:** `AppDataSource.initialize()` runs OUTSIDE `bootstrap()`, creating a second standalone DB connection alongside the NestJS-managed one. The standalone one is never used — pure resource leak.
- **ValidationPipe missing `whitelist: true`:** Extra properties in request bodies are silently accepted. Combined with `Object.assign(entity, dto)` patterns, this is a **mass assignment vulnerability** — attackers can inject `id`, `isActive`, `globalRole`, `createdAt`, etc.
- **Hardcoded CORS origin:** `http://localhost:3000` — blocks all non-localhost frontends in production.
- **Default port fallback is 3000** (same as frontend). CLAUDE.md says backend should be 5000. Env var likely saves it, but the fallback is wrong.
- **Fix Priority:** Critical

### app.module.ts
- **`synchronize: true`** with no environment guard. Combined with `migrationsRun: true`, TypeORM will auto-alter schema AND run migrations. Data loss risk in production.
- **`@ts-ignore` on BullModule** redis config — should use ConfigService.
- **AuthorizationService registered twice** (here and in AuthModule). Two instances — benign but wasteful.
- **Fix Priority:** Critical

### data-sourse.ts
- **Filename typo:** `data-sourse.ts` should be `data-source.ts`.
- **Entity list out of sync** — missing `DoctorAvailabilityOverride`, `EmployeeLeave`, `FeatureCatalog`, `OrgFeatureFlag`, `OAuthProvider`.
- **`synchronize: true`** here too.
- **Fix Priority:** Low (only used by the duplicate init)

---

## Auth Module

### AuthController
- **Backend Entity:** N/A (uses User entity)
- **Backend Service:** Solid session management, token rotation, account validation
- **Backend Controller:** Rate limiting decorators ALL commented out — login/register/forgot-password are unprotected against brute force
- **DTOs:** `ChangePasswordDto`, `AddPasswordDto`, `SelectLocationDto` defined inline in controller file, not in separate DTO files
- **OAuth callbacks:** Hardcoded redirect to `http://localhost:3000/` — won't work in production
- **Open redirect vulnerability:** `req.query.redirect || '/dashboard'` — attacker can set `redirect=https://evil.com`
- **Frontend API Service:** OK (direct apiClient calls in some components)
- **Frontend Hook:** N/A
- **Frontend UI:** LoginForm works but uses TanStack Form (inconsistent with other forms using RHF). Manual Zod `.parse()` instead of built-in validator integration.
- **CRUD Flow:** Login ✅ | Register ✅ | Refresh ✅ | Logout ✅ | OAuth ✅ (with issues)
- **Error Handling:** Backend OK | Frontend — `window.location.href = '/login'` on refresh failure (hard redirect, discards state)
- **Guard Applied:** `@Public()` correctly applied
- **Issues:**
  1. Rate limiting commented out
  2. Open redirect in OAuth callbacks
  3. Hardcoded localhost in OAuth redirect
  4. `@Transactional()` decorator is no-op (manager param never used in register/forgotPassword)
  5. `getCurrentUser()` regenerates access token on every `/auth/me` call (unnecessary)
- **Fix Priority:** Critical (rate limiting), High (open redirect, hardcoded URLs)

### JwtStrategy
- **`@ts-ignore`** on `super()` call
- **Reads `process.env.JWT_ACCESS_SECRET` directly** instead of ConfigService. If undefined, unpredictable behavior.
- **Fix Priority:** High

### JwtAuthGuard
- **Dual public-route mechanisms:** `PUBLIC_ROUTES` array (regex) AND `@Public()` decorator. Must be kept in sync manually. If a route has `@Public()` but isn't in `PUBLIC_ROUTES`, JWT is still required.
- **Fix Priority:** Medium

### TenantContextGuard
- **`/organizations` and `/locations` skip tenant validation by path prefix.** Any sub-route (e.g., `/organizations/:id/employees`) would also skip validation silently.
- **Fix Priority:** Medium

### AuthorizationService
- **N+1 query for super admin:** Fetches all orgs, then per-org `locationRepo.find()`. Should be a single query with relations.
- **`isSuperAdmin()` queries DB on every request.** Should use `globalRole` from JWT payload.
- **Fix Priority:** Medium

### TenantContextMiddleware
- **Double validation:** Middleware AND guard both validate tenant access and attach `request.tenantContext`. Two DB hits per tenant-scoped request.
- **Fix Priority:** Medium

### RoleAuthGuard (Legacy)
- Not wired into guard chain. Contains `console.log` debug statements and hardcoded `ROLE_BASED_ROUTES`. Dead code.
- **Fix Priority:** Low (removal)

---

## User Module

### UserController
- **Backend Entity:** User entity OK
- **Backend Service:** Issues found
- **Backend Controller:** Issues found
- **DTOs:** `@Body() body: any` on createUser and updateUser — **NO DTO validation at all**
- **Frontend API Service:** `users/api.ts` returns `res.data` instead of `res.data.data` — **wrong unwrapping, breaks convention**
- **Frontend Hook:** Uses inline `useQuery` instead of dedicated hooks
- **Frontend UI:** UserFormDialog uses `onSubmit(data: any)`. UserTable delete has NO confirmation dialog.
- **CRUD Flow:** Create ✅ | Read ✅ | Update ✅ | Delete ❌ (no confirmation)
- **Error Handling:** Missing — no toasts on success/error for create/update
- **Loading States:** Has loading state in UserTable
- **Empty States:** Has empty state in UserTable
- **Form Validation:** None (body: any on backend, any on frontend)
- **Response Format:** `getMe()` returns raw `UserDto`, inconsistent with ResponseWrapper pattern
- **Guard Applied:** Uses `@UseGuards(AuthGuard('jwt'))` directly instead of global guard — double execution
- **Issues:**
  1. `@Body() body: any` — no validation on create/update
  2. Default password `'defaultPassword123'` when no password provided
  3. `deleteUser()` soft deletes but doesn't revoke sessions — deleted user stays logged in
  4. Route is `'user'` (singular), legacy guard checks `'/users'` (plural)
  5. Frontend API unwraps incorrectly (`res.data` vs `res.data.data`)
  6. Delete has no confirmation dialog
  7. No success/error toasts
  8. Manually injects `x-organization-id` header (redundant with interceptor)
- **Fix Priority:** High

---

## Organizations Module

### OrganizationsController / Service
- **Backend Entity:** OK with proper relations
- **Backend Service:** Issues found
- **Backend Controller:** Issues found
- **DTOs:** `updateSettings(@Body() dto: any)` — **no validation on settings**
- **Frontend API Service:** OK
- **Frontend Hook:** OK
- **Frontend UI:** OrganizationSettingsFeature has hardcoded boolean feature flags overlapping with dynamic feature-flags module
- **CRUD Flow:** Create ✅ | Read ✅ | Update ✅ | Delete ❌ (not implemented)
- **Response Format:** Uses ResponseWrapper ✅
- **Guard Applied:** `@RequireSuperAdmin()` correctly applied ✅
- **Issues:**
  1. `updateSettings(@Body() dto: any)` — mass assignment on settings
  2. `generateSlug()` — no collision handling (two "ABC Corp" would fail)
  3. `updateSettings()` uses `Object.assign(settings, dto)` — can overwrite `id`, `createdAt`, etc.
  4. Frontend has legacy hardcoded feature flags alongside dynamic system
- **Fix Priority:** High (unvalidated settings)

---

## Locations Module

### LocationsController / Service
- **Backend Entity:** OK
- **Backend Service:** Same settings issue
- **Backend Controller:** Same settings issue
- **DTOs:** `updateSettings(@Body() dto: any)` — same as organizations
- **Frontend API Service:** OK
- **Frontend Hook:** OK
- **Frontend UI:** OK
- **CRUD Flow:** Create ✅ | Read ✅ | Update ✅ | Delete ❌ (not implemented)
- **Response Format:** Uses ResponseWrapper ✅
- **Guard Applied:** Correct
- **Issues:**
  1. `updateSettings(@Body() dto: any)` — unvalidated
  2. `getAuthorizedOrgId()` calls `resolveUserAccess()` (multiple DB queries) on every request — should be cached
- **Fix Priority:** High (unvalidated settings)

---

## Employees Module

### EmployeesController / Service
- **Backend Entity:** Employee is org-agnostic (correct for multi-location). `EmployeeOrgLocationAssignment.createdBy` is NOT NULL but could receive undefined.
- **Backend Service:** Issues found
- **Backend Controller:** OK
- **DTOs:** Mostly typed, but `employmentRoleId` not validated as `@IsUUID()`
- **Frontend API Service:** OK (`data.data` unwrapping correct)
- **Frontend Hook:** **BROKEN** — `useSalaryHistory.ts` imports `fetchSalaryHistory` which does NOT exist in the API module. Runtime crash.
- **Frontend UI:** EmployeeForm has `primaryLocationId` in defaultValues but NOT in Zod schema (silently stripped). Uses inline `useQuery` for roles instead of existing `useEmploymentRoles` hook.
- **CRUD Flow:** Create ✅ | Read ✅ | Update ✅ | Deactivate ✅
- **Error Handling:** Hooks have proper onError (mostly)
- **Loading States:** OK
- **Empty States:** OK
- **Form Validation:** Frontend Zod + Backend class-validator ✅ (mostly)
- **Response Format:** Uses ResponseWrapper ✅
- **Guard Applied:** Correct
- **Issues:**
  1. `useSalaryHistory.ts` imports non-existent function — **WILL CRASH**
  2. Employee code generation race condition (`count + 1` for concurrent requests)
  3. Phone uniqueness is GLOBAL (cross-org) — two clinics can't share a phone number
  4. `employmentRoleId` accepts any string (not validated as UUID)
  5. EmployeeForm `primaryLocationId` not in Zod schema
  6. Inline useQuery for roles duplicates existing hook
  7. `updateSalary` returns `Promise<any>`
- **Fix Priority:** Critical (broken import), Medium (race condition, validation)

### ScheduleService
- Well implemented with proper validations
- Cross-location conflict check exists but is never called — dead code
- **Fix Priority:** Low

### LeaveService
- Leave balance is location-scoped for filtering but overlap check is employee-global
- No leave quota system (balance only reports counts, doesn't enforce limits)
- **Fix Priority:** Medium

---

## Appointments Module

### AppointmentsController / Service
- **Backend Entity:** OK
- **Backend Service:** Issues found
- **Backend Controller:** OK
- **DTOs:** Typed properly ✅
- **Frontend API Service:** OK
- **Frontend Hook:** `useCancelAppointment` duplicates `useStatusMutation` pattern instead of reusing it
- **Frontend UI:** FullCalendarView uses **non-commercial license key** (`CC-Attribution-NonCommercial-NoDerivatives`) for a commercial product. ~120 lines of inline CSS.
- **CRUD Flow:** Create ✅ | Read ✅ | Update ✅ | Cancel ✅
- **Error Handling:** OK
- **Loading States:** OK
- **Empty States:** OK
- **Form Validation:** Frontend + Backend ✅
- **Response Format:** Uses ResponseWrapper ✅
- **Guard Applied:** Correct
- **Issues:**
  1. **`getStats()` loads ALL appointments into memory** then filters in JS. Should use SQL COUNT/CASE. Will degrade with volume.
  2. `findAll()` filters by `locationId` only, not `organizationId` (UUID collision unlikely but principle violation)
  3. FullCalendar non-commercial license in commercial product
  4. ~120 lines inline CSS
  5. Duplicated status mutation pattern
- **Fix Priority:** High (stats performance, license), Medium (others)

---

## Patients Module

### PatientsController / Service
- **Backend Entity:** Uses `@DeleteDateColumn` (TypeORM soft delete) — inconsistent with other modules using `isActive` flag. Good composite indexes on `organizationId`.
- **Backend Service:** 15 repository injections — very large. Patient number generation has same race condition as employee code.
- **Backend Controller:** OK, but no delete endpoint for sub-entities
- **DTOs:** Mixed — some typed, many sub-entity mutations use `any`
- **Frontend API Service:** `deletePatient` and `deactivatePatient` call the **exact same endpoint** (redundant). All sub-entity functions use `any` payloads.
- **Frontend Hook:** 13 query + 11 mutation hooks. ALL mutations use `{ patientId: string } & any`. NO `onError` handlers. NO `onSuccess` toasts.
- **Frontend UI:** PatientForm is a 4-step wizard with auto-save. **No form validation connected** — Zod schema exists in types.ts but is NOT wired to TanStack Form. No error handling on submit.
- **CRUD Flow:** Create ✅ (no validation) | Read ✅ | Update ✅ | Delete ❌ (duplicate endpoints)
- **Error Handling:** Backend OK | Frontend MISSING — errors silently swallowed
- **Loading States:** OK
- **Empty States:** OK
- **Form Validation:** Backend class-validator ✅ | Frontend **NONE** (Zod schema disconnected)
- **Response Format:** Uses ResponseWrapper ✅
- **Guard Applied:** Correct
- **Issues:**
  1. PatientForm has NO connected validation (Zod schema unused)
  2. `deletePatient` and `deactivatePatient` are identical
  3. All sub-entity mutations typed as `any` (11 hooks)
  4. No onError/onSuccess handlers on any mutation
  5. Patient number generation race condition
  6. 15 repo injections in service (should split)
  7. Inconsistent soft delete strategy (`@DeleteDateColumn` vs `isActive`)
  8. No delete endpoints for sub-entities
- **Fix Priority:** High (missing validation, silent errors), Medium (typing, architecture)

---

## Payroll Module

### PayrollController / Service
- **Backend Entity:** OK, proper unique constraint `[employeeId, month, year]`
- **Backend Service:** Well-implemented with manual QueryRunner transactions
- **Backend Controller:** `month`/`year` query params parsed with `parseInt` — no validation, `NaN` passthrough possible
- **DTOs:** OK
- **Frontend API Service:** OK
- **Frontend Hook:** OK
- **Frontend UI:** Accessible via employee detail tab
- **CRUD Flow:** Create ✅ | Read ✅ | Update ✅ | Delete ❌ (not needed)
- **Response Format:** Uses ResponseWrapper ✅
- **Guard Applied:** Correct
- **Issues:**
  1. `month`/`year` query params not validated (NaN possible)
- **Fix Priority:** Medium

---

## Feature Flags Module

### FeatureFlagsService / Guard
- **Backend Entity:** OK (FeatureCatalog + OrgFeatureFlag)
- **Backend Service:** In-memory cache with NO TTL or eviction. Unbounded memory growth with many orgs. No cross-instance consistency.
- **Backend Controller:** OK
- **DTOs:** OK
- **Frontend API Service:** OK
- **Frontend Hook:** OK
- **Frontend UI:** FeatureFlagsContext fires API call even when `enabled` is false (wasteful)
- **Guard Applied:** FeatureFlagGuard correctly integrated ✅
- **Issues:**
  1. Cache has no TTL or eviction
  2. `seedCatalog()` does individual findOne + save instead of upsert
  3. Frontend context fires API call when disabled
- **Fix Priority:** Medium

---

## Session Module

### SessionService
- **Backend Entity:** `UserSession.isCurrent` column exists but is NEVER SET — always `false`. `location` column never populated — always `null`. Dead columns.
- **Backend Service:** Solid bcrypt-hashed refresh tokens, session limits, token rotation
- **Backend Controller:** N/A (used by AuthService)
- **Issues:**
  1. Expired sessions never cleaned up (no cleanup job)
  2. `enforceSessionLimit()` loads all sessions then updates one-by-one — should use single query
  3. Dead columns: `isCurrent`, `location`
- **Fix Priority:** Medium (cleanup job), Low (dead columns)

---

## Stub Modules (chairs, inventory, invoices)

- Entity-only, no service/controller/module
- `Chair` has no `organizationId` — only `locationId`
- `Inventory.organizationId` is nullable — inconsistent with multi-tenant pattern
- Not registered in `app.module.ts`; rely on `synchronize: true` via standalone AppDataSource
- **Fix Priority:** Low (stubs, not in use)

---

## Frontend — Layout & Navigation

### Sidebar
- **CRITICAL:** Nav items include dead links: `/messages`, `/teams`, `/medical-records`, `/billing`, `/help`, `/notifications`. These routes do NOT exist — clicking produces blank pages or 404s.
- **Fix Priority:** Critical

### Topbar
- **BUG:** Destructures empty `{}` from props, ignoring `title`, `subtitle`, `actions`. Renders nothing useful.
  ```typescript
  export function Topbar({}: TopbarProps) {
  ```
- **Fix Priority:** High

### Header.tsx
- Legacy TanStack boilerplate with TanStack logo. Not imported anywhere — dead code.
- **Fix Priority:** Low (removal)

---

## Frontend — Dashboard

- **All data is mock.** Hardcoded placeholder cards with `"---"` values.
- `dashboard.api.ts` uses artificial `delay()` calls returning static data. No real API endpoints.
- **Fix Priority:** High (not functional)

---

## Frontend — Reports

- **Title typo:** "Statics Overview" should be "Statistics Overview"
- Uses dashboard mock data — entirely fake
- **Fix Priority:** High (not functional)

---

## Frontend — Settings

- **BUG:** References `user?.role` but User type has `globalRole`, not `role`. Always evaluates to `undefined`, breaking role-based conditional rendering.
- Uses direct apiClient calls instead of service layer
- Password change uses TanStack Form (inconsistent with RHF elsewhere)
- **Fix Priority:** High (broken role check)

---

## Frontend — Cross-Cutting Issues

### Form Library Inconsistency
- TanStack Form: LoginForm, PatientForm, Settings password change
- React Hook Form: EmployeeForm, UserFormDialog, others
- Creates cognitive overhead and prevents shared form utilities

### Missing Error Handling
- Most mutation hooks lack `onError` callbacks. Users get NO feedback when API calls fail.
- Affected: all 11 patient sub-entity mutations, useCreatePatient, patient new route, UserFormDialog

### Missing Toast Notifications
- Many mutations lack `onSuccess` toasts: patient creation, patient sub-entity mutations, user create/update

### `any` Type Overuse
- All patient sub-entity mutation payloads: `{ patientId: string } & any`
- All patient sub-entity API functions: `payload: any`
- Employee payroll: `(p: any)`
- UserFormDialog: `onSubmit(data: any)`
- `updateSalary` return type

### Direct API Calls Bypassing Service Layer
- SessionManagement, Settings password change, UserFormDialog (organizations query), FeatureFlagsContext

### No Route-Level Error Boundaries
- Zero route files define `errorComponent` or `pendingComponent`. Thrown errors have no graceful UI.

### No Route Loaders
- Zero route files use TanStack Router `loader` for data prefetching. All data fetching is component-level via `useQuery`.

### Hardcoded Currency
- `formatters.ts` hardcodes PKR. Should use organization's currency setting.

### Route Protection via useEffect
- Root route protection is in a `useEffect`, not route guards/loaders. Protected pages briefly flash before redirect.

### Conflicting Theme State
- `ui-store.ts` has `theme: 'light'|'dark'` AND `useTheme` hook has localStorage-based 3-value system. Two competing sources.

### Auth Store UUID Fallback
- `uuid: data.user.uuid || data.user.userUuid || ''` — inconsistent backend response shape. Empty-string UUID breaks downstream lookups.
