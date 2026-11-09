<div align="center">

<img src="../docs/images/logo.svg" alt="" width="64" />

<h1>Web app</h1>

<p><b>The clinic workspace for appointments, care, billing and operations.</b></p>

<p>
<img src="https://img.shields.io/badge/React_19-161b22?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" />
<img src="https://img.shields.io/badge/TanStack-161b22?style=for-the-badge&logo=reactquery&logoColor=FF4154" alt="TanStack" />
<img src="https://img.shields.io/badge/Tailwind_4-161b22?style=for-the-badge&logo=tailwindcss&logoColor=06B6D4" alt="Tailwind 4" />
<img src="https://img.shields.io/badge/TypeScript-161b22?style=for-the-badge&logo=typescript&logoColor=3178C6" alt="TypeScript" />
<img src="https://img.shields.io/badge/Vitest-161b22?style=for-the-badge&logo=vitest&logoColor=6E9F18" alt="Vitest" />
</p>

<p>
<a href="#quick-start"><b>Quick start</b></a> &nbsp;·&nbsp;
<a href="#features"><b>Features</b></a> &nbsp;·&nbsp;
<a href="#structure"><b>Structure</b></a> &nbsp;·&nbsp;
<a href="#testing"><b>Testing</b></a> &nbsp;·&nbsp;
<a href="#rules"><b>Rules</b></a>
</p>

<sub><a href="../README.md">← Back to the main README</a></sub>

</div>

<br />

## Quick start

**You need:** Node.js 22 and the API running locally on port `5000`.

| Step                     | Command                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| 1 · Install              | `npm install`                                                        |
| 2 · Configure (optional) | Set `VITE_API_BASE_URL` if the API is not at `http://localhost:5000` |
| 3 · Start                | `npm run dev`                                                        |

Open [http://localhost:3000](http://localhost:3000). The default API URL is `http://localhost:5000`; no web-specific `.env` file is required for local development.

<br />

## Features

The web app is the full clinic workspace. Screens are organized by feature, with access-aware routes, clinic/location context, and live updates where supported.

| Area              | Includes                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Front desk        | Appointment calendar and booking, check-in, doctor-wise queue, reception and TV displays               |
| Patient care      | Patient records, consultations, treatment plans, prescriptions and medicine directory                  |
| Billing           | Charges, invoices, payments, refunds, expenses, commissions, cash close and reports                    |
| Labs              | Lab directory and portal, orders, production, billing, payables and workflow templates                 |
| Clinic operations | Employees, locations, payroll, inventory and notifications                                             |
| Administration    | Clinic access, roles, permissions, feature switches, sidebar, theme, subscriptions and workflow studio |

<br />

## Structure

```text
src/
├── routes/       TanStack file-based routes and root shell
├── features/     Feature pages, components, hooks, API, schemas and types
├── components/   Shared layout, feedback, forms and UI components
├── context/      App-wide providers
├── hooks/        Shared React hooks
├── lib/          API client, query client, dates, currency and utilities
├── store/        Zustand state
└── test/         Test setup and helpers
```

Routes should stay thin; feature behavior belongs under `features/`. Cross-feature imports use each feature's `index.ts` barrel.

<br />

## Scripts

| Command           | What it does                           |
| ----------------- | -------------------------------------- |
| `npm run dev`     | Start Vite on port `3000`              |
| `npm run build`   | Create the production build            |
| `npm run preview` | Serve the production build locally     |
| `npm run test`    | Run Vitest                             |
| `npm run lint`    | Run ESLint                             |
| `npm run format`  | Check formatting with Prettier         |
| `npm run check`   | Format files and run ESLint with fixes |

<br />

## Testing

```bash
npm run test
npm run build
```

Vitest uses Testing Library for component and hook tests. The production build is a static SPA bundle in `.output/public` (`index.html` plus hashed assets) that talks to the API directly — no Node server at runtime. nginx serves it via the `Dockerfile`; the Tauri shell in [`desktop-app/`](../desktop-app/) serves the same bundle.

<br />

## Rules

| Rule                                          | Use                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Keep route files free of business logic       | Route files import and render feature pages                                                |
| Use TanStack Form + Zod                       | Define schemas in the feature and wire them as form validators; do not use React Hook Form |
| Put HTTP calls in feature API files           | Components call typed TanStack Query hooks, not Axios directly                             |
| Check permissions with `useAccess().can(...)` | Do not branch on role names                                                                |
| Use `@/lib/datetime` for dates and times      | Display and enter instants in the active location's timezone                               |
| Keep forms in sheets and use shared UI        | Follow the shared form and component patterns                                              |

For folder conventions, date handling, forms, access and design rules, read the root [`CLAUDE.md`](../CLAUDE.md).

<br />

<div align="center">
<sub>Part of the <a href="../README.md">Clinic Management Platform</a> · API: <a href="../backend/">backend/</a> · Mobile: <a href="../mobile-app/">mobile-app/</a></sub>
</div>
