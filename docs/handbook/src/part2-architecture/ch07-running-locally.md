# Chapter 7 — Running the Platform locally

This chapter lists what a developer needs to run the Platform on one machine: prerequisites, installation, configuration, start commands, the first super-admin step and the test suites. It is written for the product owner who wants to see the system running or hand it to a new engineer. The steps come from the `package.json` files, the backend's configuration code and `backend/database/README.md`; nothing was executed while writing this chapter. **Updated 2026-11-19:** the database is now created from SQL scripts (no automatic table creation), Node 22 is required, and the other apps (mobile, desktop, landing) are noted in 7.2.

## 7.1 Prerequisites

**Status:** [Implemented]

| Need | Why | Notes |
|---|---|---|
| Node.js and npm | All applications are Node projects. | `backend/package.json` requires Node 22.12 or newer (the Dockerfiles and CI use Node 22). |
| PostgreSQL 13 or newer | The only data store. | The account that runs `schema/01_extensions_functions.sql` must be allowed to create the `btree_gist` and `pg_trgm` extensions and a function. SSL is on by default (certificate not verified; fine for Neon). For a local PostgreSQL without SSL set `DATABASE_SSL=false`; `verify` checks the certificate. |
| Redis | Messages between processes. | Not needed for the single development process (`all` role) as long as `REDIS_URL` is unset: realtime and cache invalidation work in-process and no Redis connection is opened. Required when `api` and `worker` run as separate processes. |
| A Cloudinary account | File uploads (logos, patient documents, attachments). | Uploads fail without it; the rest of the Platform runs. |
| An SMTP mail account | Account emails (verification, reset) and notification emails. | Optional for local work: with no SMTP settings emails are only logged. Note that password accounts must verify their email, so for a real sign-up flow a mail account is needed (or a super admin marks the user verified). |

The table lists each external dependency, why the Platform needs it and what to know when setting it up locally.

**Technical references:** `backend/src/app.module.ts` · `backend/src/common/database/ensure-extensions.ts` · `README.md` (root)

## 7.2 Install

**Status:** [Implemented]

The applications are installed separately; there is no root-level install.

1. In `backend/`, run `npm install`.
2. In `web-app/`, run `npm install`.
3. Only if you work on them: `mobile-app/` (Expo; see its `CLAUDE.md`), `desktop-app/` (Tauri shell around the web build; see its README) and `landing/` (Astro marketing site), each with its own `npm install`.

**Technical references:** `backend/package.json` · `web-app/package.json`

## 7.3 Configure

**Status:** [Implemented]

1. Copy `backend/.env.example` to `backend/.env`. The template names the database (`DATABASE_URL`, `DATABASE_SSL`), the server (`PORT`, `NODE_ENV`, `CORS_ORIGIN`), the secrets (`JWT_ACCESS_SECRET`, `JWT_PATIENT_ACCESS_SECRET`, and the unused `JWT_REFRESH_SECRET`, `EMAIL_TOKEN_SECRET`, `RESET_TOKEN_SECRET`), Google sign-in, the mobile minimum-version floor, SMTP and email settings, `EXPO_ACCESS_TOKEN` and the storage and Cloudinary variables.
2. Fill in at least `DATABASE_URL`, `JWT_ACCESS_SECRET` and `JWT_PATIENT_ACCESS_SECRET`. **The API refuses to start without a patient secret that is at least 32 characters and different from the access secret.** Set `DATABASE_SSL=false` for a local PostgreSQL without SSL.
3. Add the variables the template does not list when the defaults do not fit: `REDIS_URL` (only for the split `api`/`worker` setup), `FRONTEND_URL` (default `http://localhost:3000`), `TRUST_PROXY`, and optionally the magic-link, rate-limit and patient-app limit variables. Chapter 6 lists every variable with its purpose.
4. The web app reads `VITE_API_BASE_URL` (default `http://localhost:5000`) plus the patient-app landing variables in `web-app/.env.example`. Put them in `web-app/.env` only if the defaults do not fit.

`JWT_REFRESH_SECRET`, `EMAIL_TOKEN_SECRET` and `RESET_TOKEN_SECRET` are in the template but are not read by any code. Google sign-in works when `GOOGLE_CLIENT_ID` is set (the old Google and GitHub OAuth variables were removed).

**Technical references:** `backend/.env.example` (names only) · `web-app/src/lib/api.ts`

## 7.4 Run

**Status:** [Implemented]

| Terminal | Command | Result |
|---|---|---|
| 1 | in `backend/`: `npm run start:dev` | One `all`-role process in watch mode on port 5000: HTTP API, Socket.IO, relays and scheduled jobs. |
| 2 | in `web-app/`: `npm run dev` | The web app's Vite dev server on port 3000. |

The table shows the two commands needed for a working local system. Then open `http://localhost:3000`.

**Before the first start, create the database schema by hand.** The backend does not create tables. With psql, from `backend/database/`, on an empty database: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f schema/run_all.sql` (runs `01` to `05` in order). A database that already exists is brought up to date by running the newer `changes/*.sql` scripts. Then, optionally, `npm run seed` (in `backend/`) fills an empty database with a demo: a super admin, three clinics with staff, patients and about a month of history. Never run the seed on production. Details: `backend/database/README.md` and `backend/database/seed/README.md`.

What happens on the first backend start (after the schema exists):

1. The feature catalog is seeded with the active features (insert-missing), and the system role templates are seeded into every existing organization.
2. Nothing creates or changes tables or extensions.

To try the production split locally: `npm run build`, then `npm run start:api` and `npm run start:worker` in two terminals, with Redis running and `REDIS_URL` set (both refuse to start without it). Do not start a second worker.

**Technical references:** `backend/src/main.ts` · `backend/src/bootstrap/http.ts` · `AppModule.forRole` · `FeatureFlagsService.seedCatalog` · `AccessTemplatesService`

## 7.5 The first super admin

**Status:** [Partial] — for a real (empty) database there is still no screen or command that creates a super admin; it is a manual database step. The demo seed creates one (credentials are in `backend/database/seed/README.md`; development databases only).

The super admin is the platform operator who creates organizations, approves clinics, entitles features, records subscription payments and runs Config Studio. A user is a super admin when the `users.global_role` column holds `super_admin`.

1. Open `/register` and sign up. Self-signup creates **both** a user and a new clinic: an organization that is **awaiting super admin approval** (no free trial), its `MAIN` location and the ownership link. The clinic cannot be used until a super admin approves it, which is harmless for local work.
2. Promote the user with one SQL statement against the database:

   ```sql
   UPDATE users SET global_role = 'super_admin' WHERE email = '<your sign-up email>';
   ```

3. Sign out and sign in again, so the login response reports the new role.
4. As super admin you choose an organization at sign-in, and you can open the setup pages (Organizations, Locations, Lab Directory, Config Studio, Subscriptions, clinic approvals) even before choosing a location. Approve clinics, create organizations and their locations, entitle features, then add employees and give them logins and roles (Chapter 11).

Email verification: a password account that has not verified its email can work only until its verification due date (new accounts: immediately), after which every request except `/auth/*` returns `EMAIL_NOT_VERIFIED`. Super admins, Google sessions and Google-only accounts are exempt, so the promoted super admin is not blocked.

**Technical references:** `backend/src/common/enums/global-role.enum.ts` · `backend/src/subscriptions/clinic-setup.service.ts` · `backend/src/auth/guards/email-verified.guard.ts` · `backend/src/clinic-access/` · `web-app/src/routes/__root.tsx` (`SUPER_ADMIN_SETUP_PATHS`)

## 7.6 Test suites

**Status:** [Implemented]

| Suite | Command | What it runs | Needs a database |
|---|---|---|---|
| Backend unit | in `backend/`: `npm test` | Jest over the `*.spec.ts` files in `backend/src` (134 at 2026-11-19; 67 at the snapshot), including `access-coverage.spec.ts`, which fails if any endpoint lacks an access decorator. | no |
| Backend e2e | `npm run test:e2e` | One starter test that boots the full application and calls `GET /`. | yes (it starts the real module) |
| All DB integration specs | `npm run test:int` | Every `*.int-spec.ts` file under `backend/test/` with the billing suite's setup. | yes |
| Labs | `npm run test:int:labs` | Lab module integration tests. | yes |
| Tenancy | `npm run test:int:tenancy` | Tenant isolation tests. | yes |
| Access core | `npm run test:int:access` | Access resolution, patient scope, sidebar layouts. | yes |
| Access acceptance | `npm run test:int:acceptance` | The 166-case access-control acceptance plan in 11 spec files. | yes |
| Web | in `web-app/`: `npm test` | Vitest with Testing Library and jsdom over the web app's test files (44 now; 34 at the snapshot). | no |

The table lists each test command, what it covers and whether it needs PostgreSQL. There are 42 integration spec files in total (35 at the snapshot), and a `test:int:patient` suite for the patient app was added. CI (`.github/workflows/ci.yml`) runs the backend and web unit tests, a type-check and a build on every pull request.

How the database suites protect data: each suite creates its **own PostgreSQL schema** (built with TypeORM `synchronize`, the only place that still does) (for example `billingit`, `tenancy_it`, `acceptit`), drops and recreates it at the start and drops it at the end, and never touches the `public` schema. They read `BILLING_IT_DATABASE_URL` when set, otherwise `DATABASE_URL`; for Neon they strip the connection-pooler part of the host name, because schema isolation needs a direct connection. Some suites accept a `*_KEEP_SCHEMA` variable to keep the schema for inspection. The suites share one database, so run them one at a time.

Other useful scripts: `npm run lint` and `npm run format` (backend), `npm run check` (web: Prettier and ESLint fixes), and `npm run access:export` (backend), which regenerates the web app's copy of the permission catalog after `permissions.ts` changes.

**Technical references:** `backend/package.json` · `backend/test/*.json` · `backend/test/billing/db.config.ts` · `web-app/vitest.config.ts` · `backend/scripts/export-access-catalog.ts`
