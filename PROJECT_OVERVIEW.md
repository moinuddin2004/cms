# PROJECT_OVERVIEW.md — DentalFlow / MedTrackr

**Snapshot date:** 2026-10-11 (branch `master`, HEAD `b0438bd`)
**Purpose:** A self-contained briefing for an AI assistant (or engineer) planning the next phase of work. It describes what exists, what works, what is broken, and a proposed roadmap. Every finding below was verified by reading the code or running the compiler at the snapshot date. Items marked *(unverified)* were inferred, not executed.

> Related docs in repo root: `CLAUDE.md` (intended conventions), `PLAN.md` (feature roadmap — **checklist is stale**, see §7), `AUDIT.md` (June 2026 audit — **partly outdated**, several items fixed since), `HANDOFF.md` (last session's notes).

---

## 1. What the product is

Multi-tenant SaaS for dental/medical clinics (Pakistan-focused: CNIC fields, PKT timezone, Urdu/English-speaking owner).

- **Tenancy model:** Organization → Locations → Employees / Patients / Appointments. Every core row carries `organizationId` (and usually `locationId`).
- **Users:** super admin (platform), org owners/admins, staff with portal access (doctors, receptionists).
- **Feature flags per organization** gate modules (e.g. `patients.core`, `appointments.core`, `hr.payroll`, `patients.prescriptions`, billing, inventory).

## 2. Tech stack

| Layer | Stack |
|---|---|
| Backend (`backend/`) | NestJS 11, TypeScript, TypeORM 0.3 + PostgreSQL (Neon), Passport (JWT, Google, GitHub), Bull + Redis, `@nestjs/schedule` (cron), Socket.IO gateway, Cloudinary storage, Nodemailer, pdf-lib |
| Frontend (`web-app/`) | React 19, TanStack Start/Router/Query/Form/Table, Zustand 5, shadcn/ui + Tailwind 4, Zod 4, axios, FullCalendar (resource views), Recharts, date-fns, sonner |
| Tooling | Jest (backend, effectively unused), Vitest installed (frontend, unused), ESLint, Prettier |

Ports: backend `5000` (env `PORT`), frontend `3000`. CORS origin from env `CORS_ORIGIN`.

**Size:** ~72k lines of TS/TSX across both apps. ~250 backend routes across 31 controllers.

## 3. Architecture

### 3.1 Backend request pipeline

1. `main.ts`: body limit 5 MB (signatures stored as base64 data URLs); global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`; global exception filter; cookie-parser.
2. Global guards (`app.module.ts:100-112`, order matters):
   1. `JwtAuthGuard` — Bearer token. **Uses only the hardcoded `PUBLIC_ROUTES` list** (`auth/constants/public-routes.ts`), ignores `@Public()`.
   2. `TenantContextGuard` — reads `x-organization-id` / `x-location-id` headers, validates access, sets `request.tenantContext`. Skips for `@Public()`, `@ContextFree()`, and path prefixes `/auth/`, `/organizations`, `/locations`.
   3. `FeatureFlagGuard` — enforces `@RequireFeature(key)`; super admin bypass. Enabled keys cached in `Map<orgId, Set>`.
3. Controllers return `ResponseWrapper.success(data, message)` → frontend unwraps `res.data.data`.
4. Patterns: TypeORM repositories, class-validator DTOs, soft delete via `isActive`, UUID PKs, settings upsert (`getSettings` auto-creates).

### 3.2 Frontend

- File-based routes in `web-app/src/routes/` (not `src/app/` as CLAUDE.md says).
- Feature code in `web-app/src/features/<feature>/{pages,components,hooks,services,types.ts}`.
- Shared code in `src/components/{ui,shared,layout,forms,feedback,data-display,feature}`, `src/hooks`, `src/lib` (`api.ts` axios client), `src/store` (global Zustand stores), `src/context/FeatureFlagsContext.tsx`.
- Auth: access token in Zustand memory only; refresh token httpOnly cookie; axios interceptor injects `Authorization`, `x-organization-id`, `x-location-id`; 401 → single shared refresh with request queue → on failure `clearAuth()` + hard redirect to `/login`. Session restored on boot via silent `/auth/refresh` in `routes/__root.tsx:120`.
- Feature gating on 3 layers: backend `@RequireFeature`, sidebar items with `feature:` key, `<RequireFeaturePage>` / `<FeatureGuard>` wrappers.

## 4. Module inventory (current state)

Legend: ✅ working end-to-end · 🟡 partial / has gaps · ⚪ stub / dead

### Backend

| Module | Status | Routes | Notes |
|---|---|---|---|
| auth | 🟡 | 19 | JWT access+refresh, sessions, register/login/forgot/reset, OAuth Google/GitHub (likely broken, §5.2) |
| user | ✅ | 5 | Uses `x-organization-id` header |
| organizations | 🟡 | 7 | **Super-admin check is bypassed** (§5.1) |
| locations | 🟡 | 7 | Auth done in controller; `getAuthorizedOrgId` only uses `ownerOrgs[0]` |
| employees | ✅ | 27 (5 controllers) | Employees, employment roles, schedules, leaves, availability overrides. Only `leave` has `@RequireFeature` |
| payroll | ✅ | 10 | CRUD + monthly cron `0 5 1 * *` (idempotent via unique constraint) |
| appointments | ✅ | 16 | Conflict detection, per-location daily token numbers, queue/walk-in, status tracking |
| patients | 🟡 | 38 | Patient + 14 sub-entities: dental info, teeth chart, vitals, treatment plans/items, prescriptions (legacy), documents, consents, visits, insurance, recalls, referrals, feedback, communications |
| prescriptions | 🟡 | 35 (5 controllers) | New module: medicine directory, prescription templates, treatment-plan templates, prescriptions + medicines, history, doctor signatures, PDF. Has tenant leaks (§5.1) |
| billing | 🟡 | 34 (6 controllers) | Invoices, payments, coupons, credit packages, patient credit, expenses, financial summary. Has tenant leak (§5.1) |
| inventory | ✅ | 36 (5 controllers) | Items, categories, suppliers, purchase orders, stock movements, consumption templates, patient consumption |
| feature-flags | ✅ | 8 | Catalog auto-seeded on init; `seedFlagsForOrg()` on org create; call `invalidateCache(orgId)` after mutations |
| encounters | 🟡 | 2 | Thin; no `@RequireFeature` |
| treatments | 🟡 | 2 | Thin; no `@RequireFeature`; overlaps with treatment plans |
| session | ✅ | 0 | Service only |
| chairs | ⚪ | 0 | Entity only, not registered in any module |
| common | ✅ | 1 | Uploads controller, storage abstraction (Cloudinary), decorators, logger, mail |

### Frontend routes

| Area | Routes | Status |
|---|---|---|
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/select-location`, `/sessions` | ✅ |
| Dashboard | `/dashboard` | 🟡 real API data, but timezone bug and non-functional period buttons |
| Patients | `/patients`, `/patients/new`, `/patients/$patientId` (tabbed detail) | ✅ most complete feature |
| Appointments | `/appointments` (list default, calendar day/week/month, queue view, walk-in, detail modal, print receipt) | ✅ |
| Employees / HR | `/employees`, `/employees/create`, `/employees/$id`, `/employees/$id/edit`, `/payroll` | ✅ (EmployeeForm has type errors, §5.4) |
| Prescriptions | `/prescriptions`, `/prescriptions/new`, `/prescriptions/$id`, `/medicine-directory`, `/prescription-templates`, `/treatment-plan-templates` | 🟡 admin pages not discoverable from UI (only main Prescriptions in sidebar) |
| Billing | `/invoices`, `/invoices/$invoiceId`, `/expenses`, `/financial-summary` | ✅ |
| Inventory | `/inventory` (tabs: items, suppliers, purchase orders) | ✅ |
| Admin | `/organizations`, `/organizations/$id/settings`, `/organizations/$id/features`, `/locations`, `/locations/$id/settings`, `/users`, `/settings` | ✅ |
| Reports | `/reports` | ⚪ 6-line file that only redirects |

### Not built yet

Reports/exports (CSV/PDF), SMS/WhatsApp reminders (only placeholder fields exist), SOAP clinical notes, lab orders, recurring appointments, chairs management, online payment gateway, patient notification preferences.

## 5. Known issues (prioritized)

### 5.1 🔴 Critical — security

| # | Issue | Location | Fix direction |
|---|---|---|---|
| S1 | **Live database password committed to git** (Neon Postgres URL) | `backend/test-db.ts:5`, tracked since commit `da0ad8e` | Rotate the Neon password immediately; delete `test-db.ts` and `test-appts.js` (also has hardcoded creds); purge from history if repo was ever pushed |
| S2 | **Any authenticated user can create/edit/deactivate any organization.** Path-prefix skip for `/organizations` and `/locations` returns `true` before the `@RequireSuperAdmin()` check runs | `backend/src/auth/guards/tenant-context.guard.ts:18-22, 59, 65` | Evaluate `@RequireSuperAdmin()` before any path skip; replace path prefixes with explicit `@ContextFree()` on specific handlers |
| S3 | **Cross-tenant reads (IDOR)** — lookup by ID with no org check | `GET /invoices/:id/payments` (`billing/payments.service.ts:100-105`); `GET /prescriptions/:id/history` (`prescriptions/services/prescription-history.service.ts:40`); `GET /doctor-signatures/doctor/:employeeId` + `save()` (`doctor-signature.service.ts:37,57-60`); `getPlanItems` checks patient but not plan (`patients/patients.service.ts:369-371`) | Add `organizationId` (and `locationId` where relevant) to every `findOne/find` `where`; add e2e tests per endpoint |
| S4 | Socket gateway logs raw JWTs and allows any origin | `backend/src/common/utils/socket-gateway.ts:15,24,30,33,39` | Remove logs; restrict CORS to `CORS_ORIGIN` |

### 5.2 🟠 High — auth & ops

| # | Issue | Location |
|---|---|---|
| H1 | OAuth login likely broken: JWT guard ignores `@Public()`, and `PUBLIC_ROUTES` lacks `/auth/google*`, `/auth/github*` *(unverified at runtime)* | `auth/guards/jwt.guard.ts:16-40`, `auth/constants/public-routes.ts` |
| H2 | Rate limiter: in-memory, missing on `reset-password` and `refresh`, IP from spoofable `X-Forwarded-For` | `auth/guards/rate-limiter.guard.ts:153-158`, `auth.controller.ts` |
| H3 | OAuth post-login redirect: `/\evil.com` passes the path check; hosts hardcoded to localhost | `auth.controller.ts:338-342,370-374`; `google.stategy.ts:20`; `github.strategy.ts:21` |
| H4 | Migrations unusable: only 1 stale migration (`1776356529788-create-table.ts`) missing billing/prescription/inventory/feature-flag/encounter tables; `migrationsRun` glob `dist/migrations/*.js` doesn't match build output (`dist/src/migrations/` because root-level `test-db.ts` shifts the build root). Production deploy currently depends on `synchronize` | `app.module.ts:53-59`, `src/migrations/` |
| H5 | `data-sourse.ts` (typo in name) entity list is out of sync (missing ~14 entities incl. all prescription entities, feature flags, leaves, overrides, OAuth, token counter); has `synchronize: true`; reads `process.env` directly | `backend/src/data-sourse.ts` |
| H6 | Redis required for nothing: Bull queue `submissions` has no processor (leftover from previous "Code Sprint" project). Uncommitted `.env.example` change removes `REDIS_URL` though app still connects to it | `app.module.ts:67-74`, `backend/.env.example` |
| H7 | Secrets read via `process.env` instead of `ConfigService` | `socket-gateway.ts:28`, `mail.service.ts:9-10`, `data-sourse.ts:76` |

### 5.3 🟡 Medium — backend correctness / hygiene

- `isSuperAdmin()` hits the DB on every request (`TenantContextGuard`); could use `globalRole` from JWT.
- `Object.assign(entity, dto)` in 24 places — safe today thanks to the whitelist, but fragile if a DTO ever exposes `organizationId`/`isActive`.
- `employees.service.ts:88` phone-uniqueness check is global (leaks existence across tenants; also blocks the same phone in two orgs).
- `@RequireFeature` missing on `employees`, `employment-roles`, `schedule`, `availability-overrides`, `encounters`, `treatments` controllers.
- Unused dependencies: `mongoose`, `@nestjs/mongoose`, `cache-manager`, `@nestjs/swagger`, `passport-local`, `axios`.
- Dead code: `auth/guards/role.guard.ts` (legacy RoleAuthGuard, has console.logs) + `constants/role-routes.ts`; unregistered `TenantContextMiddleware` and `ContextMiddleware`; `chairs/` entity; legacy `inventory/entities/inventory.entity.ts`.
- **Overlapping data models (needs a decision):**
  - Prescriptions: legacy `patient_prescriptions` (served by `patients.controller.ts:259-275`) **and** new `prescriptions` module — both live.
  - Treatment: `treatments` (procedures performed) vs `patient_treatment_plans` + `treatment_plan_items` (patients) vs `treatment_plan_templates` (prescriptions).
  - Visits: `patient_encounters` vs `patient_visits`.

### 5.4 🟡 Medium — frontend bugs

- **TypeScript does not compile cleanly: 14 errors** (`npx tsc --noEmit` in `web-app/`). Most are unused imports; real ones:
  - `features/employees/components/EmployeeForm.tsx:110` uses `.errors` on `ZodError` (Zod 4 renamed it to `.issues`) → validation error display broken.
  - `EmployeeForm.tsx:347,355` — `grossSalary` not in the form type; value type mismatch.
  - `features/dashboard/components/TodayScheduleTable.tsx:115` — `<Link to="/appointments">` missing required `search`.
- Dashboard timezone bug: local dates suffixed with `Z` → day/month windows shift by UTC offset (5h in PKT) (`features/dashboard/pages/DashboardPage.tsx:65-70`).
- Dashboard period buttons (Today / This week / This month / Custom) set state that no query uses (`DashboardPage.tsx:55,128`).
- Response-unwrapping inconsistency: `features/users/api.ts` returns the envelope (`res.data`) while all others return `res.data.data`; three components hedge with `data?.data?.data || data?.data` (`AppointmentModal.tsx:169`, `WalkInDialog.tsx:89`, `PrescriptionBuilder.tsx:181`) — same patient-search logic copy-pasted three times.
- Refresh interceptor reads `refreshResponse.data.data` without checking `isSuccess` (`lib/api.ts`).
- `['employment-roles']` query defined in three places.

### 5.5 🔵 Low — frontend convention drift vs `CLAUDE.md`

`CLAUDE.md` prescribes a strict structure and UI rules; the code largely does not follow them. **A decision is needed: update CLAUDE.md to match reality, or refactor the code to match CLAUDE.md.**

| Rule in CLAUDE.md | Reality |
|---|---|
| Routes in `src/app/`, zero logic | Routes in `src/routes/`; several contain full pages: `prescription-templates.tsx` (489 lines), `treatment-plan-templates.tsx` (456), `medicine-directory.tsx` (385), `employees/$employeeId.index.tsx` (315), `invoices/$invoiceId.tsx` (313), `organizations_.$id.features.tsx` (235); `__root.tsx` holds session restore + route guard; `dashboard.tsx` duplicates the auth guard |
| `features/x/api/x.api.ts` | `features/x/services/x.api.ts`; `users/api.ts` mixes API + hooks; `locations/`, `organizations/` have no service layer |
| `src/shared/...` | `src/components/`, `src/hooks/`, `src/lib/`, `src/store/` |
| Per-feature Zustand slices combined in root store | Separate global stores in `src/store/` |
| Forms in Sheets | 35 files use Dialog; only 4 use Sheet. Shared `FormSheet`, `FormInput`, `FormSelect`, `FormTextarea` exist but are unused |
| TanStack Form for every form | Mostly yes (react-hook-form is absent ✅), but 6 forms use raw `useState` (inventory suppliers/items, locations, organizations) |
| Card + list ViewToggle on every listing | Only Patients and Employees |
| Breadcrumbs on every page | **No page passes breadcrumbs** |
| Loading/Empty/Error/No-results shared states | Only Patients page uses them |
| No axios in components | ~15 components call `apiClient` directly (auth forms, AppointmentModal, WalkInDialog, EmployeeForm, PrescriptionBuilder, Sidebar, LocationSwitcher, SettingsPage, UserFormDialog, locations/orgs views) |
| No hardcoded colors / inline styles | 59 hex literals (35 in `FullCalendarView.tsx`), 50 `style={{}}` |
| Types | 138 `any` usages (worst: `patients/services/patients.api.ts` with 14) |

Large files worth splitting: `PrescriptionBuilder.tsx` (1120), `PatientForm.tsx` (969), `PurchaseOrdersTab.tsx` (699), `FullCalendarView.tsx` (696), `patients/types.ts` (678), `TeethChartTab.tsx` (663), `AppointmentsList.tsx` (583).

Dead frontend code: mock `features/dashboard/services/dashboard.api.ts` + 4 hooks + ~9 dashboard components; `EmployeeListHeader`, `PatientListHeader`, `PaginationBar`, `WeeklyGrid`, `MonthlyGrid`, `TimelineGrid`. Duplicates: `SearchInput`/`FiltersBar` in both employees and patients; `ViewMode` type ×3; two `utils/print.ts`.

## 6. Testing

- Backend: zero `*.spec.ts`. Only `test/app.e2e-spec.ts` (default "Hello World" scaffold; needs real DB + Redis).
- Frontend: zero tests; Vitest + Testing Library + jsdom installed, no config.
- `backend/test-appts.js` is a manual script with hardcoded credentials.
- **Highest-value missing tests:** tenant isolation (user from org A cannot read/write org B resources on every controller), guard chain (super admin, feature flags), appointment conflict detection, payroll cron idempotency, invoice/payment totals.

## 7. Status of PLAN.md

`PLAN.md`'s checklist is out of date — many unchecked items already exist in code:

| PLAN.md item | Actual |
|---|---|
| Waiting room queue | Built (`QueueView.tsx`, walk-in dialog, token numbers) |
| Prescription templates | Built (prescriptions module) |
| Full invoices, payments, coupons, credit packages, expenses, financial summary (Phase 5.1–5.9 backend) | Built (billing module, 6 controllers) — frontend for coupons/credit packages *(unverified)* |
| Full inventory module, transactions, low-stock | Built |
| Dashboard real data | Built (with bugs §5.4) |
| Allergy alerts, insurance, recall, referral, feedback | Partial — entities/fields exist; completeness *(unverified)* |
| Recurring appointments, SOAP notes, lab orders | Not built |
| Communications (SMS/WhatsApp), reminders | Not built (placeholder fields only) |
| Reports & exports (CSV/PDF), payroll export | Not built (`/reports` redirects) |
| Online payment gateway (5.11) | Not built |

## 8. Proposed roadmap

### Phase 0 — Emergency (same day)
1. Rotate Neon DB password; delete `backend/test-db.ts`, `backend/test-appts.js`; purge from git history if pushed.
2. Fix guard order in `TenantContextGuard` (S2).
3. Patch the four IDOR endpoints (S3).
4. Remove JWT logging + restrict CORS in socket gateway (S4).

### Phase 1 — Hardening (≈1 week)
1. Tenant-isolation e2e test suite (test DB, seed two orgs, assert 403/404 cross-org on every controller).
2. Make `JwtAuthGuard` honor `@Public()`; delete `PUBLIC_ROUTES` list; verify OAuth end-to-end (H1).
3. Rate limiter: Redis/`@nestjs/throttler`, trust-proxy config, cover reset-password/refresh (H2); fix OAuth redirect validation + env-driven URLs (H3).
4. Migrations: rename `data-sourse.ts` → `data-source.ts`, use `autoLoadEntities`-equivalent glob, move `test-db.ts` out, fix `migrationsRun` path, generate a fresh baseline migration from current entities, set `synchronize: false` everywhere except local (H4, H5).
5. Remove Bull/Redis (or give it a real job, e.g. reminders), unused deps, dead guards/middleware (H6, §5.3).
6. Frontend: fix the 14 TS errors, dashboard timezone + period filter, unify response unwrapping, add `tsc --noEmit` + lint to CI.

### Phase 2 — Consolidation (≈1–2 weeks)
1. Decide and document: single prescription model (migrate `patient_prescriptions` → `prescriptions`), single treatment model, encounters vs visits.
2. Decide CLAUDE.md vs reality; then either rewrite CLAUDE.md or run an incremental refactor (move route logic into feature pages, extract API calls from components, adopt shared states/breadcrumbs, Sheets for forms, ViewToggle on remaining listings).
3. Split the 1000-line components; dedupe patient search, SearchInput/FiltersBar, print utils; delete dead dashboard code.
4. Surface prescription admin pages (Templates & Library dropdown on Prescriptions page) — the open task from `HANDOFF.md`.
5. Bring `PLAN.md` checklist in sync with §7.

### Phase 3 — New features (from PLAN.md, re-prioritized)
1. Reports & exports (appointments, revenue, patients, payroll CSV/PDF) — data already exists, high business value.
2. Communications: SMS/WhatsApp appointment reminders behind a swappable provider interface (good use for Bull queue).
3. Clinical: SOAP notes + templates, allergy/medical alerts surfaced prominently, lab orders.
4. Recurring appointments; chairs/operatory scheduling (entity exists).
5. Insurance claims workflow; online payment gateway.

## 9. Conventions & preferences to respect when planning

- Owner communicates in Roman Urdu/English mix; prefers autonomous end-to-end execution on `master` without mid-build questions (per `HANDOFF.md`).
- Every new org-level feature must be gated in 3 layers: backend `@RequireFeature`, sidebar `feature:` key, `<RequireFeaturePage>` route wrapper.
- External providers (storage, SMS, payments) go behind a swappable interface (like `StorageProvider`).
- `react-hook-form` is banned; use TanStack Form + Zod.
- Controllers return `ResponseWrapper.success(...)`; frontend unwraps `res.data.data`.
- Never edit `components/ui/` (shadcn generated).
- Dev uses `synchronize: true`; after Phase 1, every entity change needs a migration.
