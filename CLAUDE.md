# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant dental/medical practice management SaaS (DentalFlow). Monorepo with:
- `cms/backend/` — NestJS 11 REST API (TypeScript, TypeORM, PostgreSQL)
- `cms/web-app/` — React 19 SPA (TanStack Start/Router/Query/Form/Table, shadcn/ui, Tailwind CSS 4, Zustand)

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

# TypeORM migrations
npm run migration:generate -- --name=MigrationName
npm run migration:run
npm run migration:revert
```

### Frontend (`cms/web-app/`)
```bash
npm run dev              # Dev server on port 3000
npm run build            # Production build
npm run test             # Vitest
npm run check            # Prettier write + ESLint fix
```

---

## Frontend File Structure (STRICT — Never Deviate)

```
src/
├── app/                          # TanStack Start routes ONLY — zero logic here
│   ├── __root.tsx
│   ├── _auth/
│   │   ├── login.tsx             → renders <LoginPage />
│   │   └── register.tsx          → renders <RegisterPage />
│   ├── _dashboard/
│   │   ├── layout.tsx            # Dashboard shell (sidebar + header)
│   │   ├── index.tsx             → renders <DashboardPage />
│   │   ├── patients/
│   │   │   ├── index.tsx         → renders <PatientsPage />
│   │   │   └── $patientId.tsx    → renders <PatientDetailPage />
│   │   ├── appointments/
│   │   │   ├── index.tsx         → renders <AppointmentsPage />
│   │   │   └── $appointmentId.tsx
│   │   ├── treatments/index.tsx
│   │   ├── billing/
│   │   │   ├── index.tsx
│   │   │   └── $invoiceId.tsx
│   │   ├── staff/
│   │   │   ├── index.tsx
│   │   │   └── $staffId.tsx
│   │   └── settings/index.tsx
│   └── api/                      # TanStack Start server functions only
│
├── features/                     # ALL business logic lives here
│   └── [feature-name]/
│       ├── index.ts              # barrel export — always import from here cross-feature
│       ├── pages/
│       │   ├── [Feature]Page.tsx
│       │   └── [Feature]DetailPage.tsx
│       ├── components/
│       │   ├── [Feature]Table.tsx
│       │   ├── [Feature]Card.tsx
│       │   ├── [Feature]Form.tsx
│       │   ├── [Feature]Filters.tsx
│       │   └── [Feature]Sheet.tsx
│       ├── hooks/
│       │   ├── use[Feature]s.ts       # TanStack Query hooks
│       │   ├── use[Feature]Form.ts    # TanStack Form logic
│       │   └── use[Feature]Store.ts   # Zustand slice
│       ├── api/
│       │   └── [feature].api.ts       # axios calls only
│       ├── schemas/
│       │   └── [feature].schema.ts    # Zod schemas
│       └── types/
│           └── [feature].types.ts
│
├── shared/
│   ├── components/
│   │   ├── ui/                        # shadcn/ui — auto-generated, NEVER edit manually
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── PageWrapper.tsx        # wraps every page — breadcrumbs + page header
│   │   ├── data-display/
│   │   │   ├── DataTable.tsx          # generic TanStack Table wrapper
│   │   │   ├── DataCards.tsx
│   │   │   ├── ViewToggle.tsx         # card/list toggle button
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── Avatar.tsx
│   │   │   └── StatCard.tsx
│   │   ├── feedback/
│   │   │   ├── LoadingSkeleton.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── ErrorState.tsx
│   │   └── forms/
│   │       ├── FieldWrapper.tsx       # label + error wrapper for ALL form fields
│   │       ├── FormInput.tsx
│   │       ├── FormSelect.tsx
│   │       ├── FormTextarea.tsx
│   │       ├── FormDatePicker.tsx
│   │       └── FormPhoneInput.tsx
│   ├── hooks/
│   │   ├── useDebounce.ts
│   │   ├── usePagination.ts
│   │   ├── useViewMode.ts
│   │   └── useTableFilters.ts
│   ├── lib/
│   │   ├── axios.ts                   # configured axios instance with interceptors
│   │   ├── queryClient.ts             # TanStack Query client config
│   │   └── utils.ts                   # cn() + other helpers
│   ├── store/
│   │   └── index.ts                   # Zustand root store (combines all slices)
│   └── types/
│       ├── api.types.ts               # ApiResponse<T>, PaginatedResponse<T>
│       └── common.types.ts
│
└── styles/
    └── globals.css
```

---

## Frontend Rules (Read Before Every Task)

### Route Files
- Route files in `app/` contain **ZERO logic** — only import and render the feature page
```tsx
// app/_dashboard/patients/index.tsx
import { PatientsPage } from '@/features/patients'
export default function PatientsRoute() {
  return <PatientsPage />
}
```

### Forms — TanStack Form ONLY
- **NEVER use `react-hook-form`** — it is banned from this project
- Always use `@tanstack/react-form` with `@tanstack/zod-form-adapter`
- Every form must have:
  - Zod schema in `schemas/[feature].schema.ts`
  - `useForm` hook extracted into `hooks/use[Feature]Form.ts`
  - Submit button disabled when `!canSubmit` or `isSubmitting`
  - Field-level validation with error messages shown below each field
  - Dirty state tracked — show unsaved changes warning if needed
```tsx
<form.Field name="fieldName">
  {(field) => (
    <FieldWrapper label="Label" error={field.state.meta.errors[0]}>
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
- Toggle state via `useViewMode` hook
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
- All axios calls in `[feature].api.ts` files only — never in components
- Return typed responses using `ApiResponse<T>` from `shared/types`
- TanStack Query hooks in `use[Feature]s.ts` consume the api functions

### Zustand
- Each feature has its own slice in `use[Feature]Store.ts`
- Slice handles: selected item, sheet open/close, view mode
- Root store in `shared/store/index.ts` combines all slices
- Auth store: token in memory, refresh token in httpOnly cookie (no persistence)

### Imports
- Use `@/` path alias for all imports
- Cross-feature imports always go through the feature's `index.ts` barrel
- shadcn components from `@/shared/components/ui/`
- Shared components from `@/shared/components/`

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

- No logic in route files (`app/` folder)
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
- No edits to `shared/components/ui/` (shadcn auto-generated)

---

## Backend Architecture

### Multi-tenancy
All core entities have an `organizationId` foreign key. Tenant isolation via NestJS guards. JWT tokens carry organization context. Multi-location: organizations → locations → employees/chairs/appointments.

Axios client (`web-app/src/shared/lib/axios.ts`) injects `x-organization-id` and `x-location-id` headers on every request from the Zustand auth store. Backend reads these to resolve `request.tenantContext`.

### Global Guard Chain (order matters)
Registered as `APP_GUARD` in `app.module.ts`:
1. **`JwtAuthGuard`** — validates Bearer token (skips `@Public()` / `PUBLIC_ROUTES`)
2. **`TenantContextGuard`** — validates org+location access. Skips for `@Public()`, `@ContextFree()`, path-prefixes (`/auth/`, `/organizations`, `/locations`), `@RequireSuperAdmin()`, and super admins (always exempt).
3. **`FeatureFlagGuard`** — enforces `@RequireFeature('key')`. No metadata = allow; super admin = allow; else feature must be enabled for active org.

4. **`AccessGuard`** (`src/access/`) — enforces `@Can(...perms)` (all required; class + method lists merge) and `@AnyMember()`. `AccessResolver` builds an `AccessContext` per (user, org, location, `organizations.access_version`): owner / super admin get every permission; staff get their employment role's `permissions` jsonb (`{ perm: 'own'|'location'|'org'|true }`) at that location; permissions whose feature is not active (entitled ∧ enabled ∧ not disabled at the location) are dropped. Missing key = no access (fail-closed). `@Access()` injects the context: `can`, `scope`, `applyScope(qb, perm, { own, location, ownWhere })`, `decide`. `@VisibleIf(perm)` strips DTO fields.

**Access control rules:** never check role names in code — ask `ctx.can('...')` / `useAccess().can('...')`. Permission keys live in `src/access/catalog/permissions.ts` (each tied to a feature); after editing run `npm run access:export` to regenerate `web-app/src/features/access/generated/catalog.ts`. Every handler needs `@Can`, `@AnyMember`, `@Public`, `@RequireSuperAdmin` or `@ContextFree` (handler checks itself) — `src/access/access-coverage.spec.ts` fails otherwise. Role/flag/nav changes bump `access_version` and emit realtime `access.changed` to room `org:<id>`. Frontend: routes declare `staticData: { can }` (checked once in `__root.tsx`), sidebar items come from `features/access/nav/nav.registry.ts` filtered by `can` and arranged by the clinic's `nav_layouts`. Clinic setup screens: `/admin/roles`, `/admin/features`, `/admin/navigation`, `/admin/theme`.

Auth decorators (`common/decorators/`): `@Public()`, `@ContextFree()`, `@RequireSuperAdmin()`, `@RequireFeature(key)` (only needed on `@AnyMember` routes — a permission already implies its feature), `@ActiveTenant()` → `{ organizationId, locationId }`. `@Roles`/`RolesGuard` and the old `RoleAuthGuard` are removed. Note: `JwtAuthGuard` ignores `@Public()` — unauthenticated routes must also be listed in `auth/constants/public-routes.ts`.

### Auth / Login Flow
Login resolves accessible orgs/locations, returns `requiresOrgSelection` / `requiresLocationSelection`. `__root.tsx` handles redirects: unauthenticated → `/login`; needs selection → `/select-location`. Super admins on `SUPER_ADMIN_SETUP_PATHS` bypass location-selection to bootstrap empty system. Session restore via silent `/auth/refresh` on mount.

### Backend Module Structure
Each domain is a self-contained NestJS module under `src/`:
- `auth/` — JWT (access + refresh tokens), OAuth2 (Google, GitHub), rate limiting, security logs
- `organizations/` — org settings, employee role definitions, ownership
- `locations/` — per-org locations, schedules, settings
- `patients/` — full patient records: dental charts, vitals, clinical notes, treatments, prescriptions, documents, consents, feedback
- `appointments/` — booking only: scheduling, validate, booking rules, conflict detection (DB exclusion constraint `no_doctor_overlap`), status transition map. Check-in hands over to the queue.
- `queue/` — doctor-wise clinic queue after arrival. ALL queue mutations go through `QueueOrchestrator` (transaction → session row lock → transition map → audit `queue_events` + `outbox`). `SelectionEngine` is a pure function (spec covers the 14 scenarios in both modes). Mutations need an `Idempotency-Key` header; entry actions accept `If-Match: <version>`. Realtime: Socket.IO `/realtime` rooms fed by the outbox relay. Policies: `queue_policies` (org default + location override).
- `common/clock/` — `ClockService`: "now"/"today" in the LOCATION's timezone. Never use server-local `new Date()` + `setHours()` for clinic days/times.
- `employees/` — staff records, salary, work schedules, location assignments
- `payroll/` — payroll records, payment tracking
- `feature-flags/` — per-org features: super admin sets `is_entitled` (+ optional trial `entitled_until`), owner sets `is_enabled` within that (`/admin/features`), `location_feature_overrides` can switch one off per location. Catalog seeding inserts missing keys only. Cache is invalidated across instances via Redis.
- `access/` — permission catalog, bundles, system role templates (seeded per org), resolver, guard, `/me/access`, roles admin (`/admin/roles`), nav layouts (`/admin/navigation`).
- `settings-registry/` — `config_values` (platform → org → location cascade with locks) for theme (`theme.*`) and new long-tail settings; typed settings tables (`queue_policies`, `location_billing_settings`, …) stay as they are.
- `chairs/`, `inventory/`, `invoices/` — entity-only stubs (no controller/service yet)
- `common/` — shared guards, decorators, utilities
- `session/` — user session tracking

Implemented end-to-end: auth, sessions, organizations, locations, employees, appointments (booking), queue (check-in → consultation → completion, reception board, doctor screen, TV display), patients (15+ sub-entities), payroll, feature-flags.
Stubs/missing: reports, invoices, inventory, chairs, notifications/SMS. The dashboard page reads real data; some unused dashboard widgets (`AppointmentsTable`, `KpiCard`, …) still use mock data from `dashboard.api.ts`.

### Backend Key Patterns
- **Repository pattern** via TypeORM + injectable repositories
- **DTOs** with `class-validator` for all request validation
- **Settings upsert**: `getSettings()` auto-creates row with defaults; `updateSettings()` does get-or-create then `Object.assign` + save
- **All controllers return `ResponseWrapper.success(data, message)`** — frontend unwraps `res.data.data`
- **UUID primary keys** throughout; **composite indexes** for multi-tenant queries
- **Soft deletes** via `isActive` flag in most modules

### Database
PostgreSQL (Neon-compatible with SSL). TypeORM config in `cms/backend/src/data-sourse.ts` and `app.module.ts`. **`synchronize: true` is ON in dev** — schema auto-syncs from entities, THEN pending migrations in `backend/src/migrations/` run on API startup (triggers/backfills; hand-written, idempotent). Production: synchronize off → reviewed `schema:sync:prod`, migrations still run on startup. Legacy baseline `1776356529788` is recorded as applied, never executed. Details + deploy procedure: `docs/database-migrations.md`.

### Key Environment Variables
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing |
| `REDIS_URL` | Bull job queue |
| `CLOUDINARY_*` | File uploads |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | OAuth2 |
| `SMTP_USER` / `SMTP_PASS` | Email |

Backend default port: `5000`. Frontend default port: `3000`. CORS configured for `http://localhost:3000`.
