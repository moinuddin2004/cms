# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant dental/medical practice management CMS. Monorepo with:
- `cms/backend/` — NestJS 11 REST API (TypeScript, TypeORM, PostgreSQL)
- `cms/web-app/` — React 19 SPA (TanStack Start/Router/Query, shadcn/ui, Tailwind CSS 4)

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

## Architecture

### Multi-tenancy
All core entities have an `organizationId` foreign key. Tenant isolation is enforced via NestJS guards. JWT tokens carry organization context. Multi-location support: organizations → locations → employees/chairs/appointments.

The frontend Axios client (`web-app/src/lib/api.ts`) injects `x-organization-id` and `x-location-id` headers on every request from the Zustand auth store. The backend reads these to resolve `request.tenantContext`.

### Global Guard Chain (order matters)
Registered as `APP_GUARD` in `app.module.ts`, run in this order on every request:
1. **`JwtAuthGuard`** — validates Bearer token (skips `@Public()` / `PUBLIC_ROUTES`)
2. **`TenantContextGuard`** — validates org+location access. Skips for `@Public()`, `@ContextFree()`, path-prefixes (`/auth/`, `/organizations`, `/locations`), `@RequireSuperAdmin()` (checks SA role only), and super admins (always exempt). Everyone else must send valid tenant headers.
3. **`FeatureFlagGuard`** — enforces `@RequireFeature('key')`. No metadata = allow; super admin = allow; else the feature must be enabled for the active org.

Auth decorators (in `common/decorators/`): `@Public()`, `@ContextFree()`, `@RequireSuperAdmin()`, `@RequireFeature(key)`, `@ActiveTenant()` (param decorator → `{ organizationId, locationId }`), `@Roles()` (legacy, unused). The old `RoleAuthGuard` (`auth/guards/role.guard.ts`) is legacy and NOT wired into the chain.

### Auth / Login Flow
Login resolves accessible orgs/locations and returns `requiresOrgSelection` / `requiresLocationSelection`. The frontend `__root.tsx` handles redirects: unauthenticated → `/login`; needs selection → `/select-location`. Super admins on `/organizations` and `/locations` (the `SUPER_ADMIN_SETUP_PATHS`) bypass the location-selection redirect so they can bootstrap an empty system. Session restore happens via silent `/auth/refresh` on mount.

### Backend Module Structure
Each domain is a self-contained NestJS module under `src/`:
- `auth/` — JWT (access + refresh tokens), OAuth2 (Google, GitHub), rate limiting, security logs
- `organizations/` — org settings, employee role definitions, ownership
- `locations/` — per-org locations, schedules, settings
- `patients/` — full patient records including dental charts, vitals, clinical notes, treatments, prescriptions, documents, consents, feedback
- `appointments/` — scheduling, conflict detection, status tracking, doctor-patient-location mapping
- `employees/` — staff records, salary, work schedules, location assignments
- `payroll/` — payroll records, payment tracking
- `feature-flags/` — dynamic per-org feature toggles (catalog + `org_feature_flags`). Service auto-seeds the catalog on `OnModuleInit` and caches enabled keys in memory (`Map<orgId, Set>`); call `invalidateCache(orgId)` after mutations. `seedFlagsForOrg()` runs on org creation.
- `chairs/`, `inventory/`, `invoices/` — entity-only (no controller/service yet)
- `common/` — shared guards, decorators, utilities
- `session/` — user session tracking

Implemented end-to-end: auth, sessions, organizations, locations, employees (+schedule/roles), appointments, patients (15+ sub-entities), payroll, feature-flags. Stubs/missing: dashboard (frontend uses mock data), reports, invoices, inventory, chairs, standalone notifications/SMS.

Key patterns:
- **Repository pattern** via TypeORM + injectable repositories
- **DTOs** with `class-validator` for all request validation
- **Settings upsert pattern**: `getSettings()` auto-creates a row with defaults if missing; `updateSettings()` does get-or-create then `Object.assign` + save (see org/location/feature-flags services)
- **All controllers return `ResponseWrapper.success(data, message)`** — the frontend unwraps `res.data.data`
- **UUID primary keys** throughout; **composite indexes** for multi-tenant queries
- **Soft deletes** via `isActive` flag (deactivate) in most modules

### Frontend Structure
- `src/routes/` — File-based routing (TanStack Router). Route files map 1:1 to pages.
- `src/features/` — Feature-scoped components, hooks, and API calls grouped by domain
- `src/components/ui/` — shadcn/ui primitives (do not modify directly)
- `src/components/shared/` — Shared components like `DataTable` (TanStack Table)
- `src/components/layout/` — App shell, sidebar, navigation

State management: **Zustand** for global client state (auth store has no persistence — token in memory, refresh token in httpOnly cookie); **TanStack Query** for server state. Forms use a mix of **React Hook Form + Zod** and **TanStack Form**. Calendar views use **FullCalendar**. App-wide feature gating via `context/FeatureFlagsContext.tsx` (`useFeature()`, `useSpecialty()`, `<FeatureGuard>`, `<SpecialtyGuard>`).

Per-feature folder convention: `services/*.api.ts` (Axios calls returning `data.data`), `hooks/use*.ts` (TanStack Query, query/mutation with `invalidateQueries`), and `components/`. Mirror this when adding a feature.

### Database
PostgreSQL (Neon-compatible with SSL). TypeORM config in `cms/backend/src/data-sourse.ts` and `app.module.ts`. **`synchronize: true` is ON** — schema auto-syncs from entities in dev, so new columns/tables appear without a migration. For production, turn it off and rely on migrations (`cms/backend/src/migrations/`, compiled to `dist/migrations/`, run via `migrationsRun: true`).

### Key Environment Variables
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing |
| `REDIS_URL` | Bull job queue |
| `CLOUDINARY_*` | File uploads |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | OAuth2 |
| `SMTP_USER` / `SMTP_PASS` | Email |

Backend default port: `5000`. Frontend default port: `3000`. CORS is configured for `http://localhost:3000`.
