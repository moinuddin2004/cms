# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant dental/medical practice management SaaS (codename DentalFlow; the mobile app ships as MedTrackr). Monorepo with:
- `cms/backend/` — NestJS 11 REST API (TypeScript, TypeORM, PostgreSQL)
- `cms/web-app/` — React 19 SPA (TanStack Start/Router/Query/Form/Table, shadcn/ui, Tailwind CSS 4, Zustand)
- `cms/desktop-app/` — Tauri v2 shell around the web-app bundle (no desktop-specific UI code; see its README)
- `cms/landing/` — Astro marketing site
- `cms/mobile-app/` — Expo SDK 58 app: staff space + patient space in one binary. **All mobile work (and the backend/web pieces it needs) follows `mobile-app/CLAUDE.md` and `mobile-app/docs/`** (architecture, rules, task cards, handoff log)

---

## Commands

### Backend (`cms/backend/`)
```bash
npm run start:dev        # Development server (watch mode)
npm run build            # Compile TypeScript
npm run start:prod       # Run compiled output
npm run test             # Unit tests (Jest)
npm run test:e2e         # End-to-end tests
npm run lint             # ESLint fix
npm run format           # Prettier format
npm run start:api        # Split processes (need REDIS_URL): HTTP only
npm run start:worker     #   …and jobs/outbox only
npm run test:int:<name>  # Integration suites on a real DB (access, acceptance, labs, tenancy, patient)
npm run access:export    # Regenerate the web permission catalog after editing permissions.ts
npm run seed             # Seed reference data (seed:check verifies, seed:demo = demo clinic)

# No migrations — the schema is hand-written SQL in backend/database/ (see "Database" below)
```

### Frontend (`cms/web-app/`)
```bash
npm run dev              # Dev server on port 3000
npm run build            # Production build
npm run test             # Vitest
npm run lint             # ESLint (check only)
npm run format           # Prettier check
npm run check            # Prettier write + ESLint fix
```

---

## Frontend File Structure (STRICT — Never Deviate)

TanStack Router **file-based routing** (flat file names, `.` = `/`, `_` suffix = not nested under the parent layout); `routeTree.gen.ts` is generated — never edit it.

```
web-app/src/
├── routes/                        # Route files ONLY — no business logic here
│   ├── __root.tsx                 # auth/location redirects, `staticData.can` check, providers
│   ├── login.tsx · register.tsx · select-location.tsx · confirm-email.tsx · join.$token.tsx …
│   ├── dashboard.tsx              → <DashboardLayout><DashboardPage /></DashboardLayout>
│   ├── patients/
│   │   ├── index.tsx              → /patients        (PatientsPage)
│   │   ├── new.tsx                → /patients/new
│   │   └── $patientId.index.tsx   → /patients/$patientId
│   ├── employees/ · invoices/ · prescriptions/   # same folder pattern
│   ├── appointments.tsx · queue.doctor.tsx · billing.index.tsx · inventory.tsx …
│   ├── lab-orders.tsx · lab-orders_.$orderId.tsx # `_` = detail page outside the list layout
│   ├── settings.tsx + settings.<section>.tsx     # settings shell + sub-pages
│   └── admin.roles.index.tsx · admin.features.tsx … # clinic setup screens
├── router.tsx                     # router instance
├── routeTree.gen.ts               # GENERATED
│
├── features/                      # ALL business logic lives here
│   └── [feature-name]/            # e.g. patients, appointments, queue, billing, lab-orders …
│       ├── index.ts               # barrel export — always import from here cross-feature
│       ├── pages/
│       │   ├── [Feature]Page.tsx
│       │   └── [Feature]DetailPage.tsx
│       ├── components/
│       │   ├── [Feature]Table.tsx
│       │   ├── [Feature]Card.tsx
│       │   ├── [Feature]Form.tsx
│       │   ├── FiltersBar.tsx / [Feature]Filters.tsx
│       │   └── [Feature]Sheet.tsx
│       ├── hooks/
│       │   ├── use[Feature]s.ts       # TanStack Query hooks
│       │   └── use[Feature]Form.ts    # TanStack Form logic
│       ├── services/
│       │   └── [feature].api.ts       # axios calls only (via `@/lib/api`)
│       ├── schemas/
│       │   └── [feature].schema.ts    # Zod schemas
│       ├── query-keys.ts              # optional — query key factory
│       ├── lib/ · utils/              # optional — pure helpers
│       └── types.ts                   # (or types/ folder for big features)
│
├── components/                    # shared, cross-feature UI
│   ├── ui/                        # shadcn/ui — auto-generated, NEVER edit manually
│   ├── layout/                    # DashboardLayout (title/backTo/actions), Sidebar, Topbar,
│   │                              #   PageWrapper, LocationSwitcher, BrandMark, DesktopFrame
│   ├── data-display/              # ViewToggle, StatusBadge, StatCard, InitialsAvatar, Pagination
│   ├── feedback/                  # LoadingSkeleton, EmptyState, ErrorState, NoResultsState
│   ├── forms/                     # FieldWrapper, FormInput, FormSelect, FormTextarea,
│   │                              #   NumberInput, FormSheet, fieldError
│   ├── feature/                   # RequireFeaturePage
│   └── shared/                    # DataTable (TanStack Table wrapper), ListToolbar,
│                                  #   CollapsibleFilters, DatePicker, DateRangePicker,
│                                  #   TooltipButton, ConfirmDialog, BackButton, SaveBar,
│                                  #   SearchableSelect, MultiSelect, FileUploadField, …
├── hooks/                         # useDebounce, useBackNavigation, useUnsavedChangesGuard, useTheme
├── lib/
│   ├── api.ts                     # axios instance `apiClient` (default export) + interceptors
│   ├── query-client.ts            # TanStack Query client config
│   ├── datetime.ts                # clinic-timezone helpers (see "Dates & Times")
│   ├── currency.ts · formatters.ts · zod-numbers.ts
│   └── utils.ts                   # cn() + other helpers
├── store/                         # Zustand stores, one file per area (no combined root store)
│   ├── useAuthStore.ts            # auth + active org/location
│   ├── patient-store.ts · employee-store.ts · appointment-store.ts  # view mode, drafts, filters
│   ├── ui-store.ts · nav-history-store.ts
├── context/                       # FeatureFlagsContext
└── styles.css                     # Tailwind 4 entry + theme tokens
```

---

## Frontend Rules (Read Before Every Task)

### Route Files
- Route files in `routes/` contain **no business logic** — only `createFileRoute` config (`staticData: { can }`, `validateSearch`, params) and rendering the feature page inside `DashboardLayout`. Data fetching, state and UI live in `features/`.
```tsx
// routes/patients/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PatientsPage } from '@/features/patients/pages/PatientsPage'

export const Route = createFileRoute('/patients/')({
  staticData: { can: 'patients.view' },
  component: () => (
    <DashboardLayout>
      <PatientsPage />
    </DashboardLayout>
  ),
})
```

### Forms — TanStack Form ONLY
- **NEVER use `react-hook-form`** — it is banned from this project
- Always use `@tanstack/react-form` + Zod 4. No adapter package — pass the schema straight in: `useForm({ defaultValues, validators: { onChange: schema, onSubmit: schema }, onSubmit })`. Never `.parse()` inside `onSubmit` or keep a separate useState error map instead.
- Show field errors with `fieldError(field)` (`@/components/forms/fieldError`) — schema errors are `{ message }` objects, so rendering `field.state.meta.errors[0]` directly shows nothing / `[object Object]`.
- Every form must have:
  - Zod schema in `schemas/[feature].schema.ts`, wired as `validators` (not just defined)
  - `useForm` hook extracted into `hooks/use[Feature]Form.ts`
  - Submit button disabled when `!canSubmit` or `isSubmitting`
  - Field-level validation with error messages shown below each field
  - Dirty state tracked — show unsaved changes warning if needed
```tsx
<form.Field name="fieldName">
  {(field) => (
    <FieldWrapper label="Label" error={fieldError(field)}>
      <FormInput
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
    </FieldWrapper>
  )}
</form.Field>
```

### Forms Open in Sheets
- **NEVER** open a form as a separate page (unless multi-step wizard)
- Always use shadcn `Sheet` (slide-over panel)
- Each feature has a `[Feature]Sheet.tsx` wrapping the form

### Listings — Card + List View Both Required
- Every listing page must have a View Toggle (card/list switch)
- Toggle with `ViewToggle` (`@/components/data-display/ViewToggle`); the mode lives in the feature's Zustand store (`viewMode` / `setViewMode`, e.g. `store/patient-store.ts`)
- **List view** (TanStack Table): column sorting, row hover, action column (last), pagination (size selector + prev/next + page info)
- **Card view**: responsive grid of `[Feature]Card.tsx`
- Both views show same data and support same actions

### Filters — Every Listing
- Filters row below page header on every listing
- Debounced search input (300ms) for text filters
- Filter state in Zustand store or URL search params
- Show active filter count badge when filters applied
- "Clear all filters" button appears when any filter is active
- "No results for your filters" state — different from empty state

### Back Button on Nested Pages — No Breadcrumbs
- **Do NOT use breadcrumbs.** Top-level listing pages (Patients, Employees, Prescriptions…) just show title + subtitle.
- Every nested / detail page (`/patients/$id`, `/invoices/$id`, `/prescriptions/new`, settings sub-pages, template/library pages…) shows a small ← back button left of the title.
- Use `DashboardLayout`'s `backTo` + `backLabel` props, or `BackButton` from `@/components/shared/BackButton` in a custom header.
- ← returns to the page the user actually came from (`useBackNavigation`, browser history); `backTo` is only the fallback when the page was opened directly. Post-save / post-delete redirects use `replace: true`.
- Top-level pages get a ← automatically (header icon, or a "← Back to …" link from `DashboardLayout` when the page draws its own header) **only** when reached from a link inside another page — not from the sidebar (sidebar links pass `state={SIDEBAR_NAV_STATE}`) and not when opened directly.
```tsx
<DashboardLayout title="Invoice INV-001" backTo="/invoices" backLabel="Back to invoices">
```

### Action Buttons
- Primary action (Create/Add) → filled button, top-right of page header
- Row actions → `DropdownMenu` (three-dot) for 3+ actions; icon buttons for 1-2
- Destructive (Delete) → always confirm dialog first
- Loading state on every button during async operation
- **Tooltip on every icon-only button / control — MANDATORY, whole project.** Use `TooltipButton` from `@/components/shared/TooltipButton` (`tooltip` prop is required; it doubles as `aria-label`). Switches/other icon controls wrap in `Tooltip` manually. Never ship an icon-only button without one.
- Delete = permanent and always goes through `ConfirmDialog` (`@/components/shared/ConfirmDialog`). Active/Inactive is a separate `Switch` toggle — never reuse DELETE to deactivate.

### States — Required Everywhere
- Loading → `LoadingSkeleton` (never blank screen)
- Empty → `EmptyState` (icon + message + CTA)
- Error → `ErrorState` (with retry button)
- No results (filtered) → distinct message from empty

### API Layer
- All axios calls in `features/<feature>/services/[feature].api.ts` files only — never in components; import the client from `@/lib/api`
- Return typed responses (`ApiResponse<T>` / `PaginatedResponse<T>` from the feature's `types.ts`); unwrap `res.data.data`
- TanStack Query hooks in `use[Feature]s.ts` consume the api functions

### Dates & Times — clinic timezone
- API speaks UTC instants (`…Z`) and plain `YYYY-MM-DD` calendar dates. Every instant is shown and entered on the active LOCATION's clock (`locations.timezone`, set in location settings) — never the browser's.
- All conversion goes through `@/lib/datetime`: show with `formatDate` / `formatDateTime` / `formatTime` / `formatInClinic(v, pattern)`; calendar dates with `formatYmd`; send picker values with `clinicInputToUtc` / `clinicDateTimeToUtc`; prefill with `utcToClinicInput`; "today" = `todayYmd()`; day-range filters = `clinicDayBounds(day)`; date-fns on instants takes `inClinic()`.
- Never: `new Date(x).toLocale*String()`, `format(new Date(x), …)` without `inClinic()`, `toISOString().slice(0, 10)` as "today", manual offset math.
- FullCalendar runs with `timeZone="UTC"` fed clinic wall times (`features/appointments/utils/datetime.ts`).

### Zustand
- Stores live in `src/store/` — one file per area (`patient-store.ts`, `employee-store.ts`, …); a feature may keep a small local store inside its folder (e.g. `features/auth/store`). There is no combined root store.
- A store handles: selected item, sheet open/close, view mode, filters, form drafts
- Auth store (`store/useAuthStore.ts`): refresh token is an httpOnly cookie on the web (`x-refresh-token` header on desktop). The access token, user and active org/location are currently **persisted to localStorage** via zustand `persist` (`partialize`).

### Imports
- Use `@/` path alias for all imports (`@/` = `web-app/src/`)
- Cross-feature imports always go through the feature's `index.ts` barrel
- shadcn components from `@/components/ui/`
- Shared components from `@/components/<group>/` (`shared`, `layout`, `forms`, `feedback`, `data-display`)

---

## Design System

### Colors (Tailwind classes only — no hardcoded values)
| Purpose | Class |
|---------|-------|
| Primary action / brand | `bg-primary hover:bg-primary/90` (also `text-primary`, `ring-primary`, `border-primary`, `bg-primary/10`) — follows the clinic's theme brand colour; never `blue-*` for brand |
| Destructive | `bg-red-500 hover:bg-red-600` |
| Surface | `bg-white dark:bg-slate-900` |
| Border | `border-slate-200 dark:border-slate-800` |
| Muted text | `text-slate-500` |
| Page background | `bg-slate-50 dark:bg-slate-950` |

### Spacing
- Page padding: `p-6`
- Section gaps: `space-y-6`
- Card padding: `p-4` or `p-6`
- Form field gap: `space-y-4`

### Typography
- Page title: `text-2xl font-semibold tracking-tight`
- Section title: `text-lg font-medium`
- Label: `text-sm font-medium text-slate-700`
- Muted: `text-sm text-slate-500`

### Component Style Rules
- Cards: `rounded-lg border border-slate-200 bg-white shadow-sm`
- Inputs: always shadcn `Input` — never raw `<input>`
- Dates: always `DatePicker` from `@/components/shared/DatePicker` (shadcn Popover + Calendar) — never native `type="date"`; use `DateTimePicker` for date+time
- Table rows: `hover:bg-slate-50 transition-colors`
- Buttons: always shadcn `Button` with correct `variant`

---

## What NEVER To Do

- No business logic in route files (`routes/` folder)
- No `react-hook-form` anywhere in the project
- No inline styles — Tailwind classes only
- No hardcoded colors — use design system classes above
- No direct axios calls inside components
- No forms opening as separate pages
- No listing without both card + list view
- No breadcrumbs — nested pages get a back button (`backTo`) instead
- No listing without filters row
- No form without validation and disabled submit state
- No action without loading state
- No icon-only button without a tooltip
- No list/detail without empty + error states
- No edits to `components/ui/` (shadcn auto-generated)
- No edits to `routeTree.gen.ts` (generated)

---

## Backend Architecture

### Multi-tenancy
All core entities have an `organizationId` foreign key. Tenant isolation via NestJS guards. JWT tokens carry organization context. Multi-location: organizations → locations → employees/appointments.

Axios client (`web-app/src/lib/api.ts`) injects `x-organization-id` and `x-location-id` headers on every request from the Zustand auth store. Backend reads these to resolve `request.tenantContext`.

### Global Guard Chain (order matters)
Registered as `APP_GUARD` in `app.module.ts`:
1. **`JwtAuthGuard`** — validates Bearer token (skips `@Public()`)
1b. **`EmailVerifiedGuard`** — a password account with `users.email_verified_at` null may work only until `email_verification_due_at` (new accounts: now; accounts from before enforcement: +7 days, set on first request/login); after that everything except `/auth/*` is 403 `EMAIL_NOT_VERIFIED` → web app shows `/confirm-email`. Exempt: super admins, Google sessions, Google-only (no password) accounts. All verification state goes through `user/email-verification.service.ts`; super admin can mark verified (`POST /user/:id/verify-email`), managers resend (`POST /user/:id/resend-verification`). Never return the raw `User` entity from an API — use `toUserAdminView` / `UserDto`.
2. **`TenantContextGuard`** — validates org+location access. Skips for `@Public()`, `@ContextFree()` (auth/switching routes), `@RequireSuperAdmin()` (checked first — must be a super admin), and super admins (always exempt). There is deliberately no path-prefix allow-list.
3. **`FeatureFlagGuard`** — enforces `@RequireFeature('key')`. No metadata = allow; super admin = allow; else feature must be enabled for active org.

4. **`AccessGuard`** (`src/access/`) — enforces `@Can(...perms)` (all required; class + method lists merge) and `@AnyMember()`. `AccessResolver` builds an `AccessContext` per (user, org, location, `organizations.access_version`): owner / super admin get every permission; staff get their employment role's `permissions` jsonb (`{ perm: 'own'|'location'|'org'|true }`) at that location; permissions whose feature is not active (entitled ∧ enabled ∧ not disabled at the location) are dropped. Missing key = no access (fail-closed). `@Access()` injects the context: `can`, `scope`, `applyScope(qb, perm, { own, location, ownWhere })`, `decide`. `@VisibleIf(perm)` strips DTO fields.

**Access control rules:** never check role names in code — ask `ctx.can('...')` / `useAccess().can('...')`. Permission keys live in `src/access/catalog/permissions.ts` (each tied to a feature); after editing run `npm run access:export` to regenerate `web-app/src/features/access/generated/catalog.ts`. Every handler needs `@Can`, `@AnyMember`, `@Public`, `@RequireSuperAdmin` or `@ContextFree` (handler checks itself) — `src/access/access-coverage.spec.ts` fails otherwise. Role/flag/nav changes bump `access_version` and emit realtime `access.changed` to room `org:<id>`. Frontend: routes declare `staticData: { can }` (checked once in `__root.tsx`), sidebar items come from `features/access/nav/nav.registry.ts` filtered by `can` and arranged by the clinic's `nav_layouts`. Clinic setup screens: `/admin/roles`, `/admin/features`, `/admin/navigation`, `/admin/theme`.

Auth decorators (`common/decorators/`): `@Public()`, `@ContextFree()`, `@RequireSuperAdmin()`, `@RequireFeature(key)` (only needed on `@AnyMember` routes — a permission already implies its feature), `@ActiveTenant()` → `{ organizationId, locationId }`. `@Roles`/`RolesGuard` and the old `RoleAuthGuard` are removed. Unauthenticated routes carry the `@Public()` decorator.

### Auth / Login Flow
Login resolves accessible orgs/locations, returns `requiresOrgSelection` / `requiresLocationSelection`. `__root.tsx` handles redirects: unauthenticated → `/login`; needs selection → `/select-location`. Super admins on `SUPER_ADMIN_SETUP_PATHS` bypass location-selection to bootstrap empty system. Session restore via silent `/auth/refresh` on mount.

### Backend Module Structure
Each domain is a self-contained NestJS module under `src/`:
- `auth/` — JWT (access + refresh tokens), Google sign-in (`auth/google/`: Identity Services ID token → `POST /auth/google`, matched on Google `sub` via `oauth_providers`; no GitHub), rate limiting, security logs. The session's sign-in method rides in the access token (`amr`, `hd`)
- `clinic-access/` — `ClinicGateService` (checked in TenantContextGuard): self-signup clinics start `approval_status = pending` (no free trial) and every tenant request is refused until a super admin approves (`/admin/clinics/:id/approval`); the owner's sign-in policy (`auth.*` registry keys: Google on/off, Google only, Workspace domains, join requests). Join requests (`clinic_join_requests`) come from an invite link (`clinic_invites`, `/join/<token>`, 7 days, created under Employees → Invite link) or a Workspace domain, and are approved under Employees with a role. A Google sign-in with no account shows "register your clinic, or ask your owner for an invite link" (never creates an orphan user)
- `organizations/` — org settings, employee role definitions, ownership
- `locations/` — per-org locations, schedules, settings
- `patients/` — full patient records: dental charts, vitals, clinical notes, treatments, prescriptions, documents, consents, feedback
- `appointments/` — booking only: scheduling, validate, booking rules, conflict detection (DB exclusion constraint `no_doctor_overlap`), status transition map. Check-in hands over to the queue.
- `queue/` — doctor-wise clinic queue after arrival. ALL queue mutations go through `QueueOrchestrator` (transaction → session row lock → transition map → audit `queue_events` + `outbox`). `SelectionEngine` is a pure function (spec covers the 14 scenarios in both modes). Mutations need an `Idempotency-Key` header; entry actions accept `If-Match: <version>`. Realtime: Socket.IO `/realtime` rooms fed by the outbox relay. Policies: `queue_policies` (org default + location override).
- `common/clock/` — `ClockService`: "now"/"today" in the LOCATION's timezone. Never use server-local `new Date()` + `setHours()` for clinic days/times. The process runs in UTC (`bootstrap/utc.ts`, imported first by every entry point); every instant column is `timestamptz` (date decorators included — `type: 'timestamptz'`); SQL that derives a clinic day/month from a `timestamptz` uses `AT TIME ZONE <location tz>`.
- `patient-auth/` · `patient-app/` · `patient-links/` · `patient-devices/` · `medications/` — the **patient space** (mobile app only): separate patient accounts and tokens (`JWT_PATIENT_ACCESS_SECRET`, login codes by email or Google, `patient_sessions`), routes under `/patient-api/*` and `/patient-auth/*` behind the patient fence guard, claim links that tie an account to a clinic's patient record, patient devices + Expo push, medication reminders, patient realtime. Staff and patient code never share tokens or routes.
- `devices/` · `app-version/` · `product-events/` — staff push devices (Expo), public minimum mobile version (`GET /app/min-version`), product analytics events
- `search/` — Ctrl+K quick search
- `lab-access/` — lab portal and magic links (no clinic login for labs)
- `employees/` — staff records, salary, work schedules, location assignments
- `payroll/` — payroll records, payment tracking
- `feature-flags/` — per-org features: super admin sets `is_entitled` (+ optional trial `entitled_until`), owner sets `is_enabled` within that (`/admin/features`), `location_feature_overrides` can switch one off per location. Catalog seeding inserts missing keys only. Cache is invalidated across instances via Redis (only when `REDIS_URL` is set; single `all` process needs none).
- `access/` — permission catalog, bundles, system role templates (seeded per org), resolver, guard, `/me/access`, roles admin (`/admin/roles`), nav layouts (`/admin/navigation`).
- `settings-registry/` — `config_values` (platform → org → location cascade with locks) for theme (`theme.*`) and new long-tail settings; typed settings tables (`queue_policies`, `location_billing_settings`, …) stay as they are.
- `inventory/` — implemented: items, categories, suppliers, purchase orders, stock movements/alerts, consumption templates, patient consumption (the single legacy `entities/inventory.entity.ts` is unregistered dead code)
- `billing/` — charge-based billing v2 incl. `billing/invoices/`, payments, refunds, printing (there is no top-level `invoices/` module)
- `reports/`, `lab-*`, `labs/`, `encounters/`, `treatment-plans/`, `prescriptions/`, `subscriptions/`, `engine/` — implemented (see their docs under `docs/`)
- `common/` — shared guards, decorators, utilities
- `session/` — user session tracking
- `notifications/` — the only way to notify anyone: `NotificationService.enqueue(tx, …)` (inside the caller's transaction), `enqueueSafely(tx, …)` (savepoint — never aborts the caller), or `notify(…)` (after commit, own transaction, never throws) → `notification_outbox` → `NotificationDispatcher` → providers: in-app (bell + realtime `notification.new` to socket room `user:<id>` via the queue `outbox`), email (`EmailChannelProvider`: verified address only → else `skipped_unverified`; daily cap → requeued). Audiences: doctor, coordinator, lab, `staff` (picked by owner/permission — `recipients/staff-recipients.ts`, never role names), patient (no channel yet). Events are code-owned seeds (`seeds/notification-events.seed.ts`; `emailDefault` = important, `channels` limits). Clinic rules: `/settings/notifications` (super admins also see "Mandatory emails (platform)": per clinic, force a mandatory event's email on/off over the owner's switch — `notification_platform_overrides`, `PUT /admin/clinics/:orgId/notification-overrides`); personal switches (sound, per-event email): `/settings/my-notifications` (`user_notification_prefs`). Account emails (verify, reset, security notices, lab address confirm) go direct through `MailService` and are logged in `email_log`. Plan + status: `docs/notifications-email-plan.md`

Implemented end-to-end: auth, sessions, organizations, locations, employees, appointments (booking), queue (check-in → consultation → completion, reception board, doctor screen, TV display), patients (15+ sub-entities), payroll, feature-flags.
Missing: chair/room scheduling (the `chairs` entity was removed; locations only keep a `total_chairs` count), patient email notifications (patients get push through the patient app only; email follow-ups are a later project — see `docs/notifications-email-plan.md` "Patients later"). SMS/WhatsApp have no provider. The dashboard page reads real data; some unused dashboard widgets (`AppointmentsTable`, `KpiCard`, …) still use mock data from `dashboard.api.ts`.

### Backend Key Patterns
- **Repository pattern** via TypeORM + injectable repositories
- **DTOs** with `class-validator` for all request validation
- **Settings upsert**: `getSettings()` auto-creates row with defaults; `updateSettings()` does get-or-create then `Object.assign` + save
- **All controllers return `ResponseWrapper.success(data, message)`** — frontend unwraps `res.data.data`
- **UUID primary keys** throughout; **composite indexes** for multi-tenant queries
- **Soft deletes** via `isActive` flag in most modules

### Database
Plain PostgreSQL 13+ (Neon in dev only; `DATABASE_SSL` = `true`/`verify`/`false`). **The schema is hand-maintained SQL in `backend/database/`** — `schema/` builds an empty DB (run 01→05 in order), `changes/YYYY-MM-DD_*.sql` alters existing DBs. The app NEVER changes the schema: `synchronize` is off everywhere, no TypeORM migrations, no startup DDL. Any entity change = edit the entity + its block in `schema/02_tables.sql` (or 04/05) + a `changes/` script, same commit. Never rename constraints the code catches by name (`no_doctor_overlap`, `uq_*_idempotency`, `one_active_entry_*`). Only the integration-test harnesses still `synchronize` throw-away test DBs. Details: `backend/database/README.md`.

### Key Environment Variables
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_SSL` | `true` (default, SSL unverified — Neon/managed) · `verify` · `false` (local Postgres) |
| `JWT_ACCESS_SECRET` | Staff access-token signing (refresh tokens are opaque; `JWT_REFRESH_SECRET` is not read) |
| `JWT_PATIENT_ACCESS_SECRET` | **Required at boot, every process role.** Signs patient-space access tokens: at least 32 characters and different from `JWT_ACCESS_SECRET`, or the API refuses to start |
| `PATIENT_CODE_PEPPER` | Optional pepper for stored login-code hashes (default: derived from the patient secret) |
| `PATIENT_LOGIN_CODES_PER_HOUR` / `_PER_DAY` / `_PER_IP_PER_DAY` | Caps on patient login-code emails: whole platform per hour (default 100) and per day (400), and per IP per 24 h (30, in memory). Over a cap the API still answers `{ sent: true }` but sends nothing |
| `PATIENT_FAILED_VERIFY_PER_24H` | Failed code guesses per email in 24 h before sign-in is refused (default 20) |
| `PATIENT_SESSION_MAX_DAYS` | Absolute patient session lifetime from creation (default 180) |
| `PATIENT_SESSION_RETENTION_MONTHS` / `PRODUCT_EVENT_RETENTION_DAYS` / `PATIENT_LOGIN_CODE_RETENTION_DAYS` | Daily retention job (worker / `all` only): ended patient sessions (default 6 months), product events (400 days), expired login codes (2 days). `0` = keep forever |
| `CORS_ORIGIN` | Allowed browser origins, comma separated (default `http://localhost:3000`); desktop (Tauri) origins always allowed |
| `GOOGLE_ANDROID_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` | Optional extra OAuth client ids accepted by patient sign-in |
| `MOBILE_MIN_VERSION_ANDROID` / `_IOS` / `_MESSAGE` | Minimum supported mobile build per platform for `GET /app/min-version` (`0.0.0` = no floor) |
| `EXPO_ACCESS_TOKEN` | Only if the Expo project requires an access token for push |
| `STORAGE_DRIVER` | File storage provider (default `cloudinary`) |
| `REDIS_URL` | Pub/sub between split `api`/`worker` processes. Unset = single `all` process, no Redis (`start:dev`, `start:prod`) |
| `CLOUDINARY_*` | File uploads |
| `GOOGLE_CLIENT_ID` | Google sign-in (ID token verify). Unset = Google button hidden |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Email via any SMTP (`common/mail/mail-transport.service.ts`). Only `SMTP_USER`+`SMTP_PASS` = Gmail app password. Nothing set = emails only logged |
| `EMAIL_DAILY_CAP` | Notification emails per day (default 450, 0 = none); over it they wait for tomorrow, account emails never held |
| `FRONTEND_URL` | Base for links in emails |

Backend default port: `5000`. Frontend default port: `3000`. CORS configured for `http://localhost:3000`.
