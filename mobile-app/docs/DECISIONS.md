# Decisions log (ADR-lite)

> Append-only. Implementers never change a decision; if one blocks you, write it in your
> handoff note under "Questions for architect". Only the architect (with the user) edits this file.
>
> Status: **Fixed** (user decided, do not reopen) · **Accepted** (architect decided, follow it) ·
> **Open** (waiting for the user; the listed default is what we build with until answered).

## Fixed by the user

| ID | Decision | Date |
| --- | --- | --- |
| F-01 | One app binary for staff and patients, two isolated spaces | 2026-11-11 |
| F-02 | One patient account across many clinics | 2026-11-11 |
| F-03 | Family / guardian management is in MVP | 2026-11-11 |
| F-04 | Dental first, but every feature must work for any clinic type | 2026-11-11 |
| F-05 | No product name or dental-only icons in UI | 2026-10-23 |
| F-06 | User runs all package installs; agents only write the command | 2026-11-06 |
| F-07 | No Redis. Single `all` backend process. Postgres for queues/pub-sub | 2026-10-31 |
| F-08 | UTC on the wire and in DB; clinic instants shown in the location's timezone | 2026-11-02 |
| F-09 | Money integers are named `*Minor` / `*_minor`, never `paisa` | 2026-11-02 |
| F-10 | DB schema is hand-written SQL in `backend/database/` — no migrations, no `synchronize` | 2026-11-06 |

## Accepted (architect)

| ID | Decision | Why |
| --- | --- | --- |
| A-01 | Source split by space: `src/core`, `src/staff`, `src/patient`, plus `src/shell` as the only place that sees both. Replaces the plan doc's `features/patient-*` prefix idea | A folder fence is enforceable by path-based lint and makes a future split into two apps a delete, not a refactor |
| A-02 | Separate patient JWT secret `JWT_PATIENT_ACCESS_SECRET`, `aud: 'patient'`; staff tokens get `aud: 'staff'` (tolerant for one release) | Signature failure is the real wall; `aud` is the second wall |
| A-03 | All patient endpoints under `/patient-api/*` (and `/patient-auth/*` before login), module `src/patient-app/` | One-letter distance from `/patients/*` is too dangerous |
| A-04 | Patient API never reuses staff services/controllers; thin read services with explicit DTOs | Staff services assume `TenantContext` + `ctx.can()` |
| A-05 | Patient org/patient ids come only from `request.patientContext.links`, never from params/body | Prevents cross-tenant reads |
| A-06 | Two `QueryClient`s (staff, patient), two axios clients, two auth stores | Cache and header isolation |
| A-07 | Realtime events only **invalidate** queries; they never write into the cache directly | Simple, always consistent with the server |
| A-08 | Offline = persisted read cache (allow-listed queries, encrypted MMKV, 24 h) + idempotent retry. No offline mutation queue | Queue row locks make offline writes unsafe; V2 |
| A-09 | Dose reminders are **local** notifications planned on-device in a rolling window (≤ 60 pending, 72 h) | Works offline, no push provider needed; iOS caps pending local notifications at 64 |
| A-10 | Dose times are wall-clock times in the **phone's** timezone; clinic appointments/visits are shown in **that record's location** timezone | A patient takes medicine where they are; an appointment happens at the clinic |
| A-11 | Patient space uses the neutral platform palette; clinic brand colour only as an accent on that clinic's cards. Staff space uses the active clinic's brand colour (from `GET /theme`) | Patient sees many clinics at once |
| A-12 | Patient space strings go through i18n (`t()`) from day one; staff space strings are inline English | Urdu is needed for patients; staff web is English |
| A-13 | Use logical direction classes everywhere (`ms-/me-/ps-/pe-/start-/end-`), never `ml-/mr-/pl-/pr-/left-/right-` | Keeps a later Urdu RTL switch cheap |
| A-14 | Remote push text never contains clinical details (diagnosis, medicine, amounts). Staff pushes show at most first name + token | Lock screens and shared phones |
| A-15 | Each task is one branch `mobile/<TASK-ID>-<slug>` and ends with a handoff note; the architect reviews before the next dependent task starts | Lower-model work needs a gate |
| A-16 | Mobile unit tests with jest-expo + Testing Library; pure logic (planners, guards, colour math, date helpers) must be unit-tested | No test runner exists today |

## Open (user to decide — build with the default meanwhile)

| ID | Question | Default we build with | Blocks |
| --- | --- | --- | --- |
| O-01 | App display name + bundle id / Android package | Display "Clinic"; package `com.placeholder.clinicapp` (dev/preview only) | First Play Store upload (M4) — package cannot change after publish |
| O-02 | Pilot Android-only? | Yes; iOS must still build | M4 |
| O-03 | Patient login in MVP: Google + email code (no phone OTP)? | Yes | M2-02 |
| O-04 | Clinic leaves platform: patient keeps read-only access, 30-day notice + PDF before delete | Yes | Terms text before M4 |
| O-05 | WhatsApp sender = one platform number, clinics buy message credits | Yes | V1 only |
| O-06 | Patient UI languages at pilot: English + Urdu? | English + Urdu (LTR layout in pilot, Urdu text in Noto Nastaliq) | M4 translation pass |
| O-07 | Domain for links/QR landing pages (`https://<domain>/c/<token>`) | `FRONTEND_URL` of the web app | M2-14, Android App Links |

## Change log

| Date | Change |
| --- | --- |
| 2026-11-11 | Initial log created with the doc set |
