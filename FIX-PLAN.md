# FIX-PLAN.md — Prioritized Fix List

**Date:** 2026-06-10

---

## Critical (app breaks or security vulnerability)

- [x] Fix 1: Add `whitelist: true` to ValidationPipe in `main.ts` — prevents mass assignment attacks
- [x] Fix 2: Remove duplicate `AppDataSource.initialize()` from `main.ts` (lines 29-36)
- [x] Fix 3: Add environment guard for `synchronize: true` in `app.module.ts` (only allow in dev)
- [x] Fix 4: Fix `useSalaryHistory.ts` broken import — `fetchSalaryHistory` doesn't exist in `employees.api.ts`
- [x] Fix 5: Remove dead sidebar nav links (`/messages`, `/teams`, `/medical-records`, `/billing`, `/help`, `/notifications`) — **verified already clean in git**

## High (bad user experience or significant bugs)

- [x] Fix 6: Uncomment rate limiting on auth endpoints (`auth.controller.ts`)
- [x] Fix 7: Fix open redirect in OAuth callbacks — validate redirect URL against whitelist
- [x] Fix 8: Replace hardcoded `http://localhost:3000` CORS origin with env var
- [x] Fix 9: Fix default port fallback from 3000 to 5000 in `main.ts`
- [x] Fix 10: Add proper DTOs for `UserController` create/update (replace `@Body() body: any`)
- [x] Fix 11: Add proper DTOs for organization `updateSettings` (replace `@Body() dto: any`)
- [x] Fix 12: Add proper DTOs for location `updateSettings` (replace `@Body() dto: any`)
- [x] Fix 13: Fix Topbar component — DashboardLayout no longer passes unused props
- [x] Fix 14: Fix `settings.tsx` — `user?.role` → `user?.globalRole`
- [ ] Fix 15: Fix `users/api.ts` — return `res.data.data` instead of `res.data` — **verified already correct in git**
- [x] Fix 16: Remove default password `'defaultPassword123'` in `UserService.createUser()`
- [ ] Fix 17: Fix Reports page title typo — **verified already correct in git ("Statistics Overview")**
- [x] Fix 18: Fix `appointments.service.ts` `getStats()` — use SQL aggregation instead of loading all into memory
- [ ] Fix 19: Connect Zod validation to PatientForm — **deferred; TanStack Form has its own validation**
- [ ] Fix 20: Fix `deletePatient`/`deactivatePatient` duplicate — **verified not duplicate in git**
- [ ] Fix 21: Add `onError` handlers with toast.error to patient sub-entity mutations — **verified already present in git**
- [ ] Fix 22: Add `onSuccess` toast notifications to patient mutations — **verified already present in git**
- [x] Fix 23: Fix hardcoded OAuth callback redirect URLs (`auth.controller.ts`)
- [x] Fix 24: Fix hardcoded email URLs in MailService (`http://localhost:3000`)
- [x] Fix 25: Fix `NotFoundException` to return HTTP 404 instead of 400
- [ ] Fix 26: Add confirmation dialog to UserTable delete action — **deferred (new feature)**

## Medium (not enterprise quality)

- [x] Fix 27: Replace `@ts-ignore` in JwtStrategy — use ConfigService properly
- [x] Fix 28: Replace `@ts-ignore` in BullModule config — use ConfigService
- [ ] Fix 29: Optimize `isSuperAdmin()` — read from JWT payload instead of DB query per request — **deferred (refactor)**
- [ ] Fix 30: Fix N+1 queries in `resolveUserAccess()` for super admin — **deferred (refactor)**
- [ ] Fix 31: Remove duplicate tenant validation (middleware + guard double DB hit) — **deferred (refactor)**
- [ ] Fix 32: Fix employee/patient number generation race conditions — **deferred (needs DB sequence)**
- [ ] Fix 33: Unify public-route mechanisms — **deferred (refactor)**
- [ ] Fix 34: Add expired session cleanup job — **deferred (new feature)**
- [x] Fix 35: Add `@IsUUID()` validation to `employmentRoleId` in CreateEmployeeDto
- [x] Fix 36: Fix FeatureFlagsContext — don't fire API call when `enabled` is false
- [ ] Fix 37: Add feature flag cache TTL — **deferred (enhancement)**
- [x] Fix 38: Fix EmployeeForm `primaryLocationId` not in Zod schema
- [ ] Fix 39: Add `@IsInt()` and `@Min(1)` validation to payroll `month`/`year` query params — **deferred**
- [x] Fix 40: Fix hardcoded PKR currency — `formatCurrency` now accepts currency param
- [ ] Fix 41: Add route-level error boundaries — **deferred (RouteError created but not wired to all routes)**
- [ ] Fix 42: Type patient sub-entity mutations properly — **deferred (large refactor)**
- [x] Fix 43: Revoke sessions on user deactivation (`UserService.deleteUser()`)
- [x] Fix 44: Fix conflicting theme state — simplified `ui-store.ts` to only sidebar state
- [ ] Fix 45: Consolidate form libraries — **deferred (large refactor)**

## Low (polish)

- [ ] Fix 46–55: All deferred — polish items for future sprints

## Additional fixes applied during compilation verification

- [x] Fix ConsentFormDialog: `ConsentType.GENERAL_DENTISTRY` → `ConsentType.GENERAL`
- [x] Fix DocumentFormDialog: `DocumentType.XRAY_IOPA` → `DocumentType.XRAY`
- [x] Fix TreatmentPlansTab: Added missing `AccordionTrigger` import
- [x] Fix TeethChartTab: `user.activeLocationId` → `activeLocationId` from auth store
- [x] Fix settings.tsx: `user.role` → `user.globalRole`
- [x] Removed unused imports across 12+ files (Sidebar, DataTable, AnalyticsChartCard, PatientTable, etc.)

## Compilation Status

- **Backend:** ✅ 0 TypeScript errors
- **Frontend:** ✅ 0 TypeScript errors
