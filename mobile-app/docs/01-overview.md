# 01 — Project overview

> Audience: every implementer and reviewer. Read this before any other doc.
> Product plan (source of truth for *what* and *why*): [`../DentalFlow Mobile App — Final Use Cases & Feature Plan.md`](<../DentalFlow Mobile App — Final Use Cases & Feature Plan.md>) (Roman Urdu).
> This doc set is the source of truth for *how*.

## 1. What we are building

One Expo (React Native) app with **two fully separate spaces**:

| Space | Who | What it is for | Talks to |
| --- | --- | --- | --- |
| **Staff** | Doctors, receptionists, nurses, owners of a clinic | The things staff do while walking around: run the queue, look up a patient, see today's schedule, get alerts | Existing backend API (same endpoints the web app uses) with the staff JWT |
| **Patient** | Patients and guardians (families) | One account that holds records from **many clinics**, a family "Today" list of medicine doses built from prescriptions, a live queue token, appointment confirm | New `/patient-api/*` routes with a separate patient JWT |

The product name is **not decided** and the platform serves **every clinic type**, not only dental.
Never show "DentalFlow" or any product name in UI, and never use tooth-only icons. Use neutral
medical marks or the clinic's own logo.

## 2. The two-space rule (the most important idea in this codebase)

The app is one binary, but for the backend it is **two different clients**:

- Different identity tables (`users` vs `patient_accounts`), never joined.
- Different JWT secret and `aud` claim, different refresh-token header and SecureStore key.
- Different axios client, different TanStack `QueryClient`, different Zustand stores.
- Different source folders (`src/staff/**`, `src/patient/**`) that **may not import each other** (lint-enforced).
- Only `src/core/**` (UI kit, helpers) is shared, and core imports neither space.

A person who is both staff and patient has two sessions alive at once and switches with a
button. Switching never logs out. Details: [02-architecture.md](02-architecture.md), [03-security.md](03-security.md).

## 3. Scope of the current programme

Build order (see [10-roadmap-and-tasks.md](10-roadmap-and-tasks.md)):

| Phase | Weeks (1 dev + AI) | Outcome |
| --- | --- | --- |
| 0. Foundations | 1–2 | Folder split, lint fences, storage, theming, tests, EAS, backend fences |
| 1. Staff space | 3–12 | Doctor queue, reception board, patients, notifications, push, offline cache → **staff pilot** |
| 2. Patient core | 13–24 | Patient auth, claim-by-QR, multi-clinic records, family, delete/unlink |
| 3. Patient hook | 25–30 | "Today" dose reminders (local notifications), live token, appointment confirm |
| 4. Release | 31–32 | Play Store, pilot training → **patient pilot (Android only)** |

### Explicitly out of scope (do not build, even if it looks easy)

- Teeth-chart editing on phone, prescription writing on phone, payments collection, booking/rescheduling by staff on mobile (all V1+).
- Patient self-booking of slots (patients only *request*), online payments, AI assistant, care plans, waitlist (V2).
- Water/steps/sleep tracker, health journal, caregiver task assignment (cut forever).
- Full offline mutations (V2). MVP is offline **read** cache + safe retry only.
- iOS store release before the Android pilot (iOS builds must still compile and run).

If a task seems to need any of the above, stop and ask in the handoff note.

## 4. Repo map (what you will touch)

```
cms/
├── backend/          NestJS API — rules in ../CLAUDE.md (root). Patient-space backend work lives here.
├── web-app/          React web app — only small tasks (e.g. "Link app" QR dialog, public landing pages).
└── mobile-app/       THIS app
    ├── CLAUDE.md     entry point for agents (auto-loaded)
    ├── AGENTS.md     Expo SDK rules (read before touching any Expo API)
    └── docs/         this doc set
```

## 5. Tech stack (fixed — do not add alternatives)

| Concern | Choice |
| --- | --- |
| Runtime | Expo SDK 58, React Native 0.88, React 19.3, New Architecture, React Compiler on |
| Routing | Expo Router (typed routes), `Stack.Protected` guards |
| Styling | Uniwind (Tailwind 4 for RN) + React Native Reusables (shadcn for RN) in `src/core/ui` |
| Server state | TanStack Query 5 |
| Forms | TanStack Form + Zod 4 (react-hook-form is banned) |
| Client state | Zustand 5 (memory) |
| HTTP | axios (one client per space) |
| Realtime | socket.io-client |
| Secure storage | expo-secure-store (tokens, encryption keys only) |
| Local storage | react-native-mmkv (encrypted instance for cached data, plain instance for prefs) |
| Lists | @shopify/flash-list |
| Bottom sheets | @gorhom/bottom-sheet |
| Toasts | sonner-native |
| Icons | lucide-react-native |
| Dates | date-fns 4 + @date-fns/tz, only through `@/core/datetime` |
| Push + local notifications | expo-notifications (to be installed) |
| Tests | jest-expo + @testing-library/react-native (to be installed) |
| i18n (patient space) | i18next + react-i18next + expo-localization (to be installed) |

Package installs are run **by the user**. When a task needs a package, write the exact
`npx expo install …` command in the handoff note and continue coding as if it were installed.

## 6. Glossary

| Term | Meaning |
| --- | --- |
| Space | `staff` or `patient`: a fully isolated half of the app |
| Org / organization | A clinic business (tenant). Column `organization_id` (never `tenant_id`) |
| Location | A branch of an org. Has its own timezone (`locations.timezone`) |
| Patient record | A row in the clinic's `patients` table — owned by the clinic, org-scoped |
| Patient account | A global login for a human (`patient_accounts`) — owned by the patient |
| Profile | A person whose records an account manages: `self` or a dependent (child, parent…) |
| Link | `patient_record_links`: connects a profile to one clinic's patient record |
| Claim | The act of creating a link by scanning a staff-shown QR (15-minute single-use token) |
| Queue entry | A patient's place in a doctor's queue today (`queue` module) |
| Visit token | Public, data-free token for watching one queue entry (number + position only) |
| "Today" list | Patient home: doses, appointments and care tasks for the whole family today |
| Permission | Dotted key like `queue.doctor.own`. UI asks `can('…')`, never a role name |
| PHI | Protected health information: anything about a patient's health, identity or bills |

## 7. Who does what

| Role | Who | Responsibility |
| --- | --- | --- |
| Architect / reviewer | Claude Opus | These docs, task cards, reviews, contract changes |
| Implementer | Sonnet / DeepSeek / other | One task card at a time, exactly as written; handoff note |
| Product owner | The user | Decisions in [DECISIONS.md](DECISIONS.md), installs, pilot clinic, store accounts |

The workflow loop is in [README.md](README.md#workflow).
