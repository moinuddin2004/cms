# Chapter 7 — Running the Platform locally

This chapter lists what a developer needs to run the Platform on one machine: prerequisites, installation, configuration, start commands, the first super-admin step and the test suites. It is written for the product owner who wants to see the system running or hand it to a new engineer. The steps come from the two `package.json` files, the backend's configuration code and the root README; nothing was executed while writing this chapter.

## 7.1 Prerequisites

**Status:** [Implemented]

| Need | Why | Notes |
|---|---|---|
| Node.js and npm | Both applications are Node projects. | Neither `package.json` pins a Node version. The README recommends Node 20 or newer. |
| PostgreSQL | The only data store. | The account must be allowed to create the `btree_gist` extension and a function on first start. The API always opens its connection **with SSL** (`ssl: { rejectUnauthorized: false }`), so the server must accept SSL connections; Neon does. Whether a plain local PostgreSQL without SSL works was not verified [Unverified]. |
| Redis | Messages between processes. | Not needed for the single development process (`all` role) as long as `REDIS_URL` is unset: realtime and cache invalidation work in-process and no Redis connection is opened. Required when `api` and `worker` run as separate processes. |
| A Cloudinary account | File uploads (logos, patient documents, attachments). | Uploads fail without it; the rest of the Platform runs. |
| An SMTP mail account | Verification and password-reset emails. | Optional for local work. |

The table lists each external dependency, why the Platform needs it and what to know when setting it up locally.

**Technical references:** `backend/src/app.module.ts` · `backend/src/common/database/ensure-extensions.ts` · `README.md` (root)

## 7.2 Install

**Status:** [Implemented]

The two applications are installed separately; there is no root-level install.

1. In `backend/`, run `npm install`.
2. In `web-app/`, run `npm install`.

**Technical references:** `backend/package.json` · `web-app/package.json`

## 7.3 Configure

**Status:** [Implemented]

1. Copy `backend/.env.example` to `backend/.env`. The template names: `DATABASE_URL`, `PORT`, `NODE_ENV`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, the Google and GitHub OAuth pairs, `EMAIL_TOKEN_SECRET`, `RESET_TOKEN_SECRET`, `SMTP_USER`, `SMTP_PASS` and the three `CLOUDINARY_*` variables.
2. Fill in at least `DATABASE_URL` and `JWT_ACCESS_SECRET`. Leave `NODE_ENV` unset or not `production`, so the schema is created from the entities.
3. Add the variables the template does not list when the defaults do not fit: `REDIS_URL` (only for the split `api`/`worker` setup), `CORS_ORIGIN` and `FRONTEND_URL` (default `http://localhost:3000`), and optionally the magic-link and rate-limit variables. Chapter 6 lists every variable with its purpose.
4. The web app reads one variable, `VITE_API_BASE_URL` (default `http://localhost:5000`). Put it in `web-app/.env` only if the API runs elsewhere.

Several template entries have no effect: `JWT_REFRESH_SECRET`, `EMAIL_TOKEN_SECRET` and `RESET_TOKEN_SECRET` are not read by any code, and the OAuth variables do nothing because OAuth is not registered.

**Technical references:** `backend/.env.example` (names only) · `web-app/src/lib/api.ts`

## 7.4 Run

**Status:** [Implemented]

| Terminal | Command | Result |
|---|---|---|
| 1 | in `backend/`: `npm run start:dev` | One `all`-role process in watch mode on port 5000: HTTP API, Socket.IO, relays and scheduled jobs. |
| 2 | in `web-app/`: `npm run dev` | The web app's Vite dev server on port 3000. |

The table shows the two commands needed for a working local system. Then open `http://localhost:3000`.

What happens on the first backend start:

1. The `btree_gist` extension and the `uuid_generate_v7()` function are created.
2. TypeORM `synchronize` creates every table from the entities.
3. The legacy migration baseline is recorded and the two hand-written migrations run (triggers and backfills).
4. The feature catalog is seeded with the 24 active features, and the 5 system role templates are seeded into every existing organization.

To try the production split locally: `npm run build`, then `npm run start:api` and `npm run start:worker` in two terminals, with Redis running and `REDIS_URL` set (both refuse to start without it). Do not start a second worker.

**Technical references:** `backend/src/main.ts` · `backend/src/bootstrap/http.ts` · `AppModule.forRole` · `FeatureFlagsService.seedCatalog` · `AccessTemplatesService`

## 7.5 The first super admin

**Status:** [Partial] — there is no screen, command or seed that creates a super admin; it is a manual database step.

The super admin is the platform operator who creates organizations, entitles features, records subscription payments and runs Config Studio. A user is a super admin when the `users.global_role` column holds `super_admin`.

1. Open `/register` and sign up. Self-signup creates **both** a user and a new clinic: an organization on a 14-day trial with Professional limits, its `MAIN` location and the ownership link. That trial clinic is harmless for local work.
2. Promote the user with one SQL statement against the database:

   ```sql
   UPDATE users SET global_role = 'super_admin' WHERE email = '<your sign-up email>';
   ```

3. Sign out and sign in again, so the login response reports the new role.
4. As super admin you choose an organization at sign-in, and you can open the setup pages (Organizations, Locations, Lab Directory, Config Studio, Subscriptions) even before choosing a location. Create an organization and its locations, entitle features, then add employees and give them logins and roles (Chapter 11).

Email verification does not block sign-in.

**Technical references:** `backend/src/common/enums/global-role.enum.ts` · `backend/src/subscriptions/clinic-setup.service.ts` · `web-app/src/routes/__root.tsx` (`SUPER_ADMIN_SETUP_PATHS`)

## 7.6 Test suites

**Status:** [Implemented]

| Suite | Command | What it runs | Needs a database |
|---|---|---|---|
| Backend unit | in `backend/`: `npm test` | Jest over the 67 `*.spec.ts` files in `backend/src`, including `access-coverage.spec.ts`, which fails if any endpoint lacks an access decorator. | no |
| Backend e2e | `npm run test:e2e` | One starter test that boots the full application and calls `GET /`. | yes (it starts the real module) |
| All DB integration specs | `npm run test:int` | Every `*.int-spec.ts` file under `backend/test/` with the billing suite's setup. | yes |
| Labs | `npm run test:int:labs` | Lab module integration tests. | yes |
| Tenancy | `npm run test:int:tenancy` | Tenant isolation tests. | yes |
| Access core | `npm run test:int:access` | Access resolution, patient scope, sidebar layouts. | yes |
| Access acceptance | `npm run test:int:acceptance` | The 166-case access-control acceptance plan in 11 spec files. | yes |
| Web | in `web-app/`: `npm test` | Vitest with Testing Library and jsdom over 34 test files. | no |

The table lists each test command, what it covers and whether it needs PostgreSQL. There are 35 integration spec files in total.

How the database suites protect data: each suite creates its **own PostgreSQL schema** (for example `billingit`, `tenancy_it`, `acceptit`), drops and recreates it at the start and drops it at the end, and never touches the `public` schema. They read `BILLING_IT_DATABASE_URL` when set, otherwise `DATABASE_URL`; for Neon they strip the connection-pooler part of the host name, because schema isolation needs a direct connection. Some suites accept a `*_KEEP_SCHEMA` variable to keep the schema for inspection. The suites share one database, so run them one at a time.

Other useful scripts: `npm run lint` and `npm run format` (backend), `npm run check` (web: Prettier and ESLint fixes), and `npm run access:export` (backend), which regenerates the web app's copy of the permission catalog after `permissions.ts` changes.

**Technical references:** `backend/package.json` · `backend/test/*.json` · `backend/test/billing/db.config.ts` · `web-app/vitest.config.ts` · `backend/scripts/export-access-catalog.ts`
