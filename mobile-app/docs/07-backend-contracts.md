# 07 — Backend contracts

> Part 2 = **existing** endpoints the staff app consumes (verified in code on 2026-11-11; file:line
> references let you re-check). Part 3–6 = **new** endpoints to build. If the code disagrees with
> this doc, the code wins for existing endpoints — note it in your handoff; for new endpoints this
> doc wins — ask before deviating.
> Paths are relative to `cms/backend/`. There is **no global route prefix**.

## 1. Conventions (all endpoints)

- Success: `{ data, message, isSuccess: true, httpStatusCode }` (`src/common/dtos/ResponseWrapper.ts`).
  Clients unwrap `res.data.data`.
- Error: `{ isSuccess: false, httpStatusCode, message, devMessage, error }` — machine code is
  `error.code` (`src/common/exceptions/HttpExceptionHandler.ts:55-62`). Validation arrays: `message[0]`.
- Paginated: `{ data: T[], total, page, limit, totalPages }` inside `data`. Exception: `GET /appointments`
  has no `totalPages`.
- Staff auth: `Authorization: Bearer <staff access>`, tenant headers `x-organization-id`, `x-location-id`,
  `x-client-type: mobile`.
- Global ValidationPipe: `whitelist`, `forbidNonWhitelisted`, `transform` — **unknown body fields are
  rejected (400)**. Send only documented fields.
- Rate limit breach: `429 { statusCode, message, retryAfter }`.

## 2. Existing endpoints used by the staff app

### 2.1 Auth (`src/auth/auth.controller.ts`, `src/auth/google/google-auth.controller.ts`)

| Method + path | Notes |
| --- | --- |
| POST `/auth/login` | `{ email, password, rememberMe? }` → LoginResponse (+ `refreshToken` for native) |
| POST `/auth/refresh` | header `x-refresh-token: <sessionId:token>` → LoginResponse, token rotated |
| POST `/auth/select-location` | `{ organizationId, locationId }` → `{ activeOrganizationId, activeLocationId }` |
| POST `/auth/switch-location` | same body; use for switching after first selection |
| POST `/auth/logout` | header `x-refresh-token` |
| GET `/auth/google/config` | `{ enabled, clientId }` |
| POST `/auth/google` | `{ credential: <Google ID token>, rememberMe? }` → `{ outcome: 'signed_in', session } \| { outcome: 'no_account', … } \| { outcome: 'link_required', … }` |
| GET `/me/access` | `@ContextFree`; needs `x-organization-id` → `{ permissions, features, isOwner, isSuperAdmin, employeeId, homeRoute, nav, version }` |
| GET `/theme` | resolved theme for the active tenant: `{ app_name, logo_url, logo_dark_url, brand_color, default_mode, dark_base, … }` (`src/settings-registry/theme/theme.controller.ts:51`) |

Native refresh rules: `src/auth/native-client.ts` — honoured only when `x-client-type: mobile` and
**no** `Origin` header.

### 2.2 Notifications inbox (`src/notifications/controllers/my-notifications.controller.ts`, `@ContextFree`)

| Method + path | Request | Response |
| --- | --- | --- |
| GET `/me/notifications` | `page`, `limit` (≤50), `unreadOnly='true'` | paged `{ id, organizationId, eventCode, title, body, link, readAt, createdAt }` |
| GET `/me/notifications/unread-count` | — | `{ count }` |
| POST `/me/notifications/read-all` | — | `{ updated }` |
| POST `/me/notifications/:id/read` | — | the row |
| GET / PUT `/me/notifications/prefs` | PUT `{ sound?, email?: Record<eventCode, boolean> }` | prefs |

### 2.3 Queue (`src/queue/controllers/*.ts`, `src/queue/services/queue-query.service.ts`)

**Headers.** Every mutation below marked **Idem** requires `Idempotency-Key` (1–200 chars; hashed with
method+path+body; same key + different body → `422 IDEMPOTENCY_KEY_REUSED`). Entry actions marked
**IfM** accept `If-Match: "<entry.version>"` → `409 VERSION_CONFLICT` when stale.
Retry rule (web parity, `web-app/src/features/queue/services/queue.api.ts:34-64`): same key, retry on
network error or `503 LOCK_TIMEOUT`, backoff 250 ms × (attempt+1) + jitter, max 3.

**Enums.** `EntryStatus`: `waiting | called | in_consultation | on_hold | skipped | completed | cancelled |
transferred | aborted`. `SessionStatus`: `waiting_for_doctor | open | paused | closed`. `QueueType`:
`appointment | walk_in`. `PriorityClass`: `normal | authorized_urgent`. `SelectionReason`: `URGENT |
STARVATION_GUARD | APPOINTMENT_DUE | RETURNED_FROM_TEST | FIFO | MANUAL_SELECT`.

**Views.**

```ts
interface EntryView {
  id: string; sessionId: string; token: string /* "A-007" */; tokenNumber: number;
  queueType: QueueType; status: EntryStatus; priorityClass: PriorityClass;
  urgentReason: string | null; urgentSince: string | null;
  patient: { id: string; fullName: string; phone: string; patientNumber: string } | null;
  appointmentId: string | null; scheduledStart: string | null; reasonForVisit: string | null;
  checkedInAt: string | null; sortAnchorAt: string | null; calledAt: string | null;
  consultationStartedAt: string | null; holdStartedAt: string | null; returnedFromHoldAt: string | null;
  skippedAt: string | null; finishedAt: string | null;
  convertedFromApptId: string | null; transferredFromId: string | null; version: number;
}
interface SessionView {
  id: string; organizationId: string; locationId: string; doctorId: string; doctorName: string;
  serviceDate: string /* YYYY-MM-DD */; status: SessionStatus; tokenPrefix: string;
  smartQueueEnabled: boolean; pauseReason: string | null; startedAt: string | null;
  closedAt: string | null; lastCallReason: SelectionReason | null; eventSeq: number; version: number;
}
interface SessionSnapshot {
  session: SessionView; entries: EntryView[]; waitingOrder: string[] /* entry ids */;
  suggestion: { entryId: string; reason: SelectionReason } | null; now: string;
}
```

**Doctor** (`doctor-queue.controller.ts`, `@Controller('queue')`)

| Method + path | Perm | Body | Hdr | Returns |
| --- | --- | --- | --- | --- |
| GET `/queue/my-session` | `queue.doctor.own` | — | | SessionSnapshot (creates today's session if missing) |
| PATCH `/queue/sessions/:id/start` | `queue.doctor.own` | — | Idem | `{ session }` |
| PATCH `/queue/sessions/:id/pause` | `queue.doctor.own` | `{ reason }` (required, ≤500) | Idem | `{ session }` |
| PATCH `/queue/sessions/:id/resume` | `queue.doctor.own` | — | Idem | `{ session }` |
| PATCH `/queue/sessions/:id/close` | `queue.doctor.own` | `{ decisions: [{ entryId, action: 'cancel'\|'transfer', toDoctorId? }] }` | Idem | `{ session }` |
| PATCH `/queue/sessions/:id/mode` | `queue.entry.reprioritize` | `{ smartQueueEnabled }` | Idem | `{ session }` |
| POST `/queue/sessions/:id/call-next` | `queue.doctor.own` | — | Idem | `{ entry \| null, reason, eventSeq }` — `reason: 'NO_ELIGIBLE_PATIENT'` when none |
| PATCH `/queue/entries/:id/select` | `queue.doctor.own` | `{ reason? }` | Idem IfM | `{ entry, eventSeq }` |
| PATCH `/queue/entries/:id/recall` | `queue.doctor.own` | — | Idem | `{ entry, eventSeq }` |
| PATCH `/queue/entries/:id/undo-call` | `queue.doctor.own` | — | Idem IfM | `{ entry, eventSeq }` |
| PATCH `/queue/entries/:id/skip` | any member (reception or own doctor) | — | Idem IfM | `{ entry, eventSeq }` |
| PATCH `/queue/entries/:id/start-consultation` | `queue.doctor.own` | — | Idem IfM | `{ entry, eventSeq, encounterId }` |
| PATCH `/queue/entries/:id/send-for-test` | `queue.doctor.own` | `{ reason? }` | Idem IfM | `{ entry, eventSeq }` |
| PATCH `/queue/entries/:id/complete` | `queue.doctor.own` | — | Idem IfM | `{ entry, eventSeq }` |
| PATCH `/queue/entries/:id/abort` | `queue.doctor.own` | `{ reason? }` | Idem IfM | `{ entry, eventSeq }` |

**Board / reception** (`queue.controller.ts`)

| Method + path | Perm | Body / query | Hdr | Returns |
| --- | --- | --- | --- | --- |
| GET `/queue/sessions?date=` | `queue.board.view` | `date` YYYY-MM-DD optional | | `{ serviceDate, now, policy, lanes: [{ doctor: { id, fullName, designation, profilePictureUrl, tokenPrefix }, snapshot: SessionSnapshot \| null }] }` |
| GET `/queue/sessions/:id` | board view or own doctor | — | | SessionSnapshot |
| GET `/queue/sessions/:id/next-preview` | same | — | | `{ suggestion, waitingOrder, eventSeq }` |
| GET `/queue/entries/:id/ticket` | board view or doctor | — | | `{ clinicName, locationName, doctorName, serviceDate, token, queueType, patientName, scheduledStart, checkedInAt, peopleAhead, status }` |
| GET `/queue/patients/:patientId/visits` | `patients.view` | — | | `EntryView[]` + `serviceDate, locationId, doctorId, doctorName` |
| POST `/queue/walk-ins` | `queue.checkin` | `{ doctorId, patientId? \| (patientName ≤150 + patientPhone ≤20), reasonForVisit? ≤500, force?, urgentReason? ≤500 }` | Idem | `{ entry, token, sessionId, doctorId, serviceDate, eventSeq }` — creates the patient when name+phone are sent |
| POST `/queue/sessions` | any member | `{ doctorId? }` | (none) | SessionSnapshot (opens a lane) |
| PATCH `/queue/entries/:id/cancel` | `queue.entry.manage` | `{ reason? }` | Idem IfM | `{ entry, eventSeq }` |
| PATCH `/queue/entries/:id/rejoin` | `queue.entry.manage` | `{ placeAfterEntryId? }` | Idem IfM | `{ entry, eventSeq }` |
| PATCH `/queue/entries/:id/return-from-test` | `queue.checkin` | — | Idem IfM | `{ entry, eventSeq }` |
| PATCH `/queue/entries/:id/transfer` | any member (server checks) | `{ toDoctorId, reason? }` | Idem IfM | `{ from, entry, token, sessionId }` |
| PATCH `/queue/entries/:id/priority` | `queue.entry.reprioritize` | `{ reason }` required | Idem IfM | `{ entry, eventSeq }` |
| PATCH `/appointments/:id/check-in` | `queue.checkin` | `{ urgentReason? }` | Idem | arrival result (as walk-ins) |
| POST `/appointments/:id/convert-to-walk-in` | `queue.checkin` | `{ urgentReason? }` | Idem | arrival result |

**There is no reorder endpoint.** Order changes only via priority, select, rejoin, mode.

**Queue error codes → UI copy** (`src/queue/queue.errors.ts`)

| `error.code` | Copy |
| --- | --- |
| `NOT_FOUND` | "This patient is no longer in the queue." (refetch) |
| `FORBIDDEN` | "You can't do this for another doctor's queue." |
| `INVALID_TRANSITION` | "This patient's status changed. Please check and try again." (refetch) |
| `SESSION_NOT_OPEN` | "The session isn't open. Start or resume it first." |
| `DOCTOR_BUSY` | "Finish the current patient first." |
| `VERSION_CONFLICT` | "This patient's status changed. Please check and try again." (refetch) |
| `ALREADY_CHECKED_IN` | "Already checked in." (refetch) |
| `ACTIVE_WITH_OTHER_DOCTOR` | dialog → resend with `force: true` (S-02c) |
| `LATE_LIMIT_EXCEEDED` | dialog → convert to walk-in (S-03) |
| `NOT_TODAY` | "This appointment isn't today." |
| `LOCK_TIMEOUT` | auto-retry with the same key; after 3 → "Busy, please try again." |
| `IDEMPOTENCY_KEY_REQUIRED` / `_REUSED` / `REQUEST_IN_FLIGHT` | developer bug → generic error + `log.error` |
| `REASON_REQUIRED` | field error on the reason input |

### 2.4 Patients (`src/patients/patients.controller.ts`; every `:id` route is scope-checked → 404 outside scope)

| Method + path | Perm | Notes |
| --- | --- | --- |
| GET `/patients` | `patients.view` | `page`, `limit` (≤100), `sortBy` (`createdAt\|fullName\|patientNumber`), `sortOrder`, `search` (name/phone/MR no., ILIKE), `gender`, `isActive`, `isMinor`, … → paged PatientResponseDto |
| GET `/patients/:id` | `patients.view` | `{ id, patientNumber, fullName, phone, dob, gender, bloodGroup, medicalHistory, allergies, isMinor, guardianName, guardianPhone, guardianRelation, isBlacklisted, blacklistReason, tags, isActive, emergencyContact*, … }` |
| POST `/patients` | `patients.create` | required `fullName` ≤150, `phone` ≤20; optional `dob, gender, isMinor, guardianName, guardianPhone, guardianRelation, …` |
| GET `/patients/check-phone/:phone?excludeId=` | `patients.view` | `{ exists }` |
| GET `/patients/:id/history` | `patients.clinical.view` | `{ patient, appointments[], encounters[], standaloneTreatments[] }` |
| GET `/prescriptions/patient/:patientId?page=&limit=` | `patients.clinical.view` + feature `patients.prescriptions` | paged prescriptions |
| GET `/patients/:id/vitals` | `patients.clinical.view` | latest vitals for overview |
| GET `/patients/:id/teeth-charts` | `patients.clinical.view` + feature `patients.teeth_chart` | read-only summary |

Alerts are computed client-side (web: `web-app/src/features/patients/components/tabs/OverviewTab.tsx:238-306`):
allergies (comma split), blacklisted + reason, minor + guardian.

### 2.5 Appointments (`src/appointments/appointments.controller.ts`)

| Method + path | Perm | Notes |
| --- | --- | --- |
| GET `/appointments` | `appointments.view` (own scope → own only) | `startDate`, `endDate` (UTC ISO, use `clinicDayBounds`), `doctorId`, `status`, `includeWalkIns`, `search`, `page`, `limit` (default 50) → `{ data, total, page, limit }`, rows have `queueEntry: { id, token, status, sessionId } \| null` |
| GET `/appointments/doctors` | | doctor list for filters/pickers |
| GET `/appointments/stats?startDate&endDate` | | `{ total, completed, cancelled, noShow, scheduled, checkedIn, walkIns, waiting, inProgress, avgWaitMinutes, completionRate, noShowRate }` |
| GET `/appointments/:id` | | detail |

`AppointmentStatus`: `scheduled | confirmed | checked_in | completed | cancelled | no_show`.

### 2.6 Realtime `/realtime` (`src/queue/realtime/queue.gateway.ts`)

- Connect: `io(`${apiUrl}/realtime`, { transports: ['websocket'], auth: { token } })`.
  Invalid token → event `auth_error { message }`. No token = anonymous (display rooms only).
- Server auto-joins `user:<userId>`.
- Subscribe: `socket.emit('subscribe', { room }, ack)` → ack `{ ok, room, error? }`. Leave: `emit('unsubscribe', { room })`.
- Rooms: `session:<uuid>`, `location:<uuid>:board`, `org:<uuid>` (and `location:<uuid>:display`, unused by mobile).
- Events (event name = payload `type`):

| Event | Room | Payload | Mobile reaction |
| --- | --- | --- | --- |
| `queue.event` | `session:<id>`, `location:<id>:board` | `{ type, sessionId, seq, eventType, entryId, fromStatus, toStatus, occurredAt }` | if `seq > snapshot.eventSeq` → invalidate session / board keys |
| `notification.new` | `user:<id>` | `{ type, id, organizationId, eventCode, title, body, link, createdAt }` | invalidate inbox + count; toast if foreground |
| `access.changed` | `org:<id>` | `{ organizationId, version }` | invalidate `accessKeys.all` |

Reference clients: `web-app/src/features/queue/hooks/useQueueSocket.ts`, `useQueueData.ts`,
`web-app/src/features/notifications/hooks/useNotificationSocket.ts`, `web-app/src/features/access/hooks/useAccessSocket.ts`.

### 2.7 Dashboard data (no dashboard endpoint exists — compose)

| Tile | Perm | Endpoint |
| --- | --- | --- |
| Appointment/queue stats | `appointments.view` | GET `/appointments/stats` (today's clinic-day bounds) |
| Next appointments | `appointments.view` | GET `/appointments?startDate=<now>&endDate=<end of day>&limit=5` |
| Doctors now | `queue.board.view` | GET `/queue/sessions` |
| Collected today, outstanding | `billing.invoice.view` + `reports.financial.view` & feature `billing.financial_summary` | GET `/financial-summary/daily` → `{ totalCollections, invoicesGenerated, paymentMethodBreakdown, outstandingAmount, overdueCount }`; fallback GET `/invoices/stats?from&to` |

Money fields here are **decimal amounts** (not minor). Format with `formatMoney(amount, currency)`.

## 3. Patient visibility rules

| Data | Patient sees | Control |
| --- | --- | --- |
| Appointments (time, doctor, location, status) | Always | fixed |
| Prescriptions | Only `status = finalized` (or amended) with `signed_at` set | fixed |
| Invoices, payments, balance | Default on | setting `patient_app.show_billing` (org) |
| Visit date, doctor, follow-up date | Always | fixed |
| Diagnosis / treatment names | Default on | setting `patient_app.show_diagnosis` (org) |
| Documents | Only `is_visible_to_patient = true` (V1) | per document |
| Clinical notes, internal notes, costs, commissions, audit, staff names other than the doctor | **Never** | fixed |

## 4. New: staff-side endpoints (existing guard chain)

### 4.1 App link (claim tokens) — module `src/patient-links/` (M2-04)

| Method + path | Perm | Body | Response |
| --- | --- | --- | --- |
| POST `/patients/:patientId/app-link/claim-token` | `patients.app_link.manage` | — | `{ token, url, expiresAt }` — `url = ${FRONTEND_URL}/c/${token}`; token returned only here |
| GET `/patients/:patientId/app-link` | `patients.view` | — | `{ status: 'none' \| 'active', link: { id, linkedAt, maskedEmail, relation, linkMethod } \| null, pendingClaim: { expiresAt } \| null }` |
| DELETE `/patients/:patientId/app-link` | `patients.app_link.manage` | `{ reason? }` | `{ revoked: true }` — audit log + push to the account |

Issuing a new token invalidates older unused tokens for the same patient. Patient must be in the
caller's scope (`@PatientInScope`). Feature `patient_app` must be active.

**As built (M2-04):** token = 32 random bytes base64url (43 chars), only its sha256 is stored, valid
**15 min**, single use. Audit rows are ids only (never the token). Revoke is allowed for a suspended
clinic; create is not.

| Error | When |
| --- | --- |
| `409 ALREADY_LINKED` | create: the patient already has an active/frozen link |
| `403 CLINIC_SUSPENDED` | create: org `is_active = false` (A-19) |
| `403 CLINIC_NOT_APPROVED` | create: org approval is not `approved` |
| `403 PATIENT_APP_DISABLED` | feature `patient_app` off |
| `404 NOT_LINKED` | revoke: no active/frozen link |

`DELETE` also invalidates pending tokens and writes `patient_access_log` (`unlink`).

### 4.2 Devices (push) — module `src/devices/` (M1-04)

| Method + path | Access | Body | Response |
| --- | --- | --- | --- |
| POST `/me/devices` | `@ContextFree()` (user-owned, no tenant) | `{ expoPushToken, platform: 'android'\|'ios', deviceLabel? ≤80, appVersion ≤20 }` | `{ id }` — upsert by token; a token moves to the calling user if it belonged to another user |
| DELETE `/me/devices` | same | `{ expoPushToken }` | `{ deleted }` |

### 4.3 App version — `GET /app/min-version` (`@Public`, M0-08)

`{ android: '1.0.0', ios: '1.0.0', message?: string }` from env `MOBILE_MIN_VERSION_ANDROID` /
`MOBILE_MIN_VERSION_IOS` (default `0.0.0`).

## 5. New: patient auth `/patient-auth/*` — module `src/patient-auth/` (M2-02)

All `@Public()` + `@RateLimit` + `@PatientAuthRoute()` metadata (so `PatientFenceGuard` lets them through).

| Method + path | Body | Response | Rate limit |
| --- | --- | --- | --- |
| POST `/patient-auth/email/start` | `{ email }` | `{ sent: true }` always | 5 / 15 min per email, 20 / 15 min per IP |
| POST `/patient-auth/email/verify` | `{ email, code (6 digits), termsVersion, privacyVersion }` | `PatientSession` | 10 / 15 min per email |
| POST `/patient-auth/google` | `{ idToken, termsVersion, privacyVersion }` | `PatientSession` | 30 / 15 min per IP |
| POST `/patient-auth/refresh` | header `x-patient-refresh-token` | `PatientSession` (rotated) | 300 / 5 min |
| POST `/patient-auth/logout` | header `x-patient-refresh-token` | `{ ok: true }` | |

```ts
interface PatientSession {
  account: { id: string; fullName: string | null; email: string };
  accessToken: string;          // JWT, aud 'patient', 15 min
  refreshToken: string;         // "<sessionId>:<token>" — SecureStore only
  isNewAccount: boolean;
  needsName: boolean;           // true → app asks for a name, then PATCH /patient-api/me
}
```

Error codes: `CODE_INVALID` (wrong/expired/too many tries — one code for all), `GOOGLE_TOKEN_INVALID`,
`ACCOUNT_DISABLED`, `SESSION_INVALID` (refresh), `ACCOUNT_LINK_CONFLICT` (409, Google: the email's account
already has a different Google identity — use the email-code sign-in).
Google: reuse `GoogleIdentityService` but accept an **array** of audiences
(`GOOGLE_CLIENT_ID` + `GOOGLE_ANDROID_CLIENT_ID` + `GOOGLE_IOS_CLIENT_ID`) — small change in
`src/auth/google/google-identity.service.ts` (verifyIdToken `audience` accepts an array). Match
identities on `(provider='google', subject=sub)`; else by verified email; else create.
Email code mail: new public `MailService.sendLoginCode(email, code)` template (the generic `send` is private).

## 6. New: patient API `/patient-api/*` — module `src/patient-app/` (M2-03 …)

Every controller: `@PatientApi()`; context from `request.patientContext`:

```ts
interface PatientContext {
  accountId: string;
  sessionId: string;
  profiles: { id: string; relation: Relation; isSelf: boolean }[];
  links: { id: string; profileId: string; organizationId: string; patientId: string; status: 'active' | 'frozen'; patientAppEnabled: boolean }[];
}
```

`frozen` links and links whose org has `patient_app` off are **read-only** (mutations → `403 PATIENT_APP_DISABLED`).
Ids not in context → **404 `NOT_FOUND`**.

### 6.1 Shared response pieces

```ts
type Relation = 'self' | 'child' | 'parent' | 'spouse' | 'other';
interface ClinicRef { organizationId: string; name: string; logoUrl: string | null; brandColor: string }
interface LocationRef { id: string; name: string; timezone: string; phone: string | null; whatsapp: string | null; address: string | null }
```

### 6.2 Endpoints

| Method + path | Body / query | Response | Task |
| --- | --- | --- | --- |
| GET `/patient-api/me` | — | `{ id, fullName, email, createdAt }` | M2-02 |
| PATCH `/patient-api/me` | `{ fullName }` | same | M2-02 |
| DELETE `/patient-api/me` | `{ confirm: 'DELETE' }` | `{ deleted: true }` — as built, see §6.6 | M2-11 |
| GET `/patient-api/claims/:token` | — | `{ clinic: ClinicRef, location: { name }, maskedName, ageBand, isMinor, alreadyLinkedToYou }` | M2-04 |
| POST `/patient-api/claims/:token/accept` | `{ relation, profileId? , newProfileName? ≤150, confirm: true }` | `{ link, profile }` | M2-04 |
| GET `/patient-api/profiles` | — | `Profile[]` `{ id, relation, fullName, dob, gender, isSelf, links: { id, clinic, location, status, linkedAt }[] }` | M2-10 |
| POST `/patient-api/profiles` | `{ relation: child / parent / spouse / other, fullName ≤150, dob?, gender? }` | `Profile` (201) | M2-10 |
| PATCH `/patient-api/profiles/:id` | `{ relation?, fullName?, dob?, gender? }` (`null` clears dob / gender) | `Profile` | M2-10 |
| DELETE `/patient-api/profiles/:id` | — | `{ removed: true }` | M2-10 |
| GET `/patient-api/links` | — | `{ id, profileId, clinic, location, status: active / frozen / revoked, linkedAt, linkMethod, linkedByLabel, revokedAt, revokedBy }[]` | M2-11 |
| DELETE `/patient-api/links/:id` | — | `{ revoked: true }` | M2-11 |
| GET `/patient-api/links/:id/history` | — | `{ at, action: linked / unlinked_by_you / revoked_by_clinic / revoked_by_system, label }[]` newest first | M2-11 |
| GET `/patient-api/appointments` | `from?` (UTC), `to?`, `profileId?` | `{ id, profileId, clinic, location, doctorName, startTime, endTime, status, type, patientConfirmedAt, canConfirm }[]` | M2-08 |
| POST `/patient-api/appointments/:id/confirm` | — | appointment | M3-08 |
| GET `/patient-api/visits` | `profileId?`, `page`, `limit` | paged `{ id, profileId, clinic, location, date (YYYY-MM-DD), doctorName, followUpDate, diagnosis? , treatments?: string[] }` | M2-08 |
| GET `/patient-api/prescriptions` | `profileId?`, `page`, `limit` | paged `{ id, profileId, clinic, location, doctorName, number, issuedAt, medicinesCount, hasPdf }` | M2-08 |
| GET `/patient-api/prescriptions/:id` | — | above + `medicines: { name, nameUrdu, type, dosage, frequency, frequencyTiming: string[], mealRelation, duration, instructions, instructionsUrdu }[]`, `pdfUrl` | M2-08 |
| GET `/patient-api/billing/summary` | `profileId?` | `{ clinic, currency, billedMinor, paidMinor, balanceMinor, invoices: { id, number, issuedAt, timezone, totalMinor, paidMinor, balanceMinor, status }[] }[]` (only clinics with `show_billing`) | M2-08 |
| GET `/patient-api/queue/active` | — | `{ entryId, profileId, clinic, location, token, status, doctorName, peopleAhead, nowServingToken, serviceDate }[]` (today, active statuses) | M3-05 |
| GET `/patient-api/medications` | `updatedSince?`, `profileId?` | `{ items: MedicationSchedule[], nextUpdatedSince: string | null }` (see 6.5) | M3-02 |
| PATCH `/patient-api/medications/:id` | `{ times?: string[], endDate?: string \| null, status?: 'active'\|'paused'\|'stopped' }` | `MedicationSchedule` | M3-02 |
| GET `/patient-api/medications/dose-events` | `from`, `to` (UTC) | `{ scheduleId, dueAt, action, actedAt }[]` | M3-02 |
| POST `/patient-api/medications/dose-events` | `{ events: { scheduleId, dueAt, action: 'taken'\|'skipped', actedAt }[] }` (≤200) | `{ accepted: number }` — upsert on `(schedule_id, due_at)`, latest `actedAt` wins | M3-02 |
| POST `/patient-api/devices` | `{ expoPushToken, platform, deviceLabel?, appVersion }` | `{ id }` | M3-07 |
| DELETE `/patient-api/devices` | `{ expoPushToken }` | `{ deleted }` | M3-07 |

**Claims as built (M2-04)** — rate limit 30 / 15 min per IP on both routes.
`link = { id, profileId, clinic: ClinicRef, location: LocationRef | null, status: 'active', linkedAt, linkMethod: 'staff_qr', linkedByLabel: 'Clinic QR' }`,
`profile = { id, relation, fullName, dob, gender, isSelf }`. `maskedName` = first name + initials (`Ali R. K.`; one word → `A***`);
`ageBand` is `0-12 | 13-17 | 18-39 | 40-59 | 60+ | null`. Profile choice: `profileId` (must be the account's and match `relation`,
else `404 NOT_FOUND` / `400 RELATION_MISMATCH`); no `profileId` + `self` → the account's self profile (created if missing);
no `profileId` + another relation → new profile, `newProfileName` required (`400 NAME_REQUIRED`). Accept stores a
`patient_account_consents` row (`kind='link'`, version `1.0`), a `patient_access_log` row (`link`) and an audit row.
Errors: `404 CLAIM_INVALID` (unknown / malformed / used / invalidated / expired token, and a clinic never approved: one
code, no enumeration), `403 CLINIC_SUSPENDED`, `403 PATIENT_APP_DISABLED`, `409 ALREADY_LINKED` (clinic patient held by another
account). Accepting a link the same account already holds is idempotent.

```ts
interface MedicationSchedule {
  id: string; profileId: string; source: 'prescription' | 'manual';
  clinic: ClinicRef | null; prescriptionId: string | null; prescriptionMedicineId: string | null;
  name: string; nameUrdu: string | null; doseText: string;
  mealRelation: 'BEFORE_MEAL' | 'AFTER_MEAL' | 'WITH_MEAL' | 'EMPTY_STOMACH' | 'NONE';
  times: string[];              // wall-clock "HH:mm", phone timezone (A-10)
  startDate: string;            // YYYY-MM-DD
  endDate: string | null;       // null = unknown → app asks patient
  endDateSource: 'parsed' | 'patient' | 'unknown';
  status: 'active' | 'paused' | 'completed' | 'stopped';
  instructions: string | null; instructionsUrdu: string | null; updatedAt: string;
}
```

### 6.4 Read endpoints as built (M2-08) — notes

- `ClinicRef` returned by these endpoints also carries `clinicStatus: 'active' | 'suspended'` (A-19) and `brandColor` may be `null`. A clinic that was never approved (pending/rejected) returns **no** records; a suspended clinic (`organizations.is_active = false`) stays readable with `clinicStatus: 'suspended'`.
- Every record carries `location.timezone` (IANA); show instants on that clock. `visits[].date` is already the `YYYY-MM-DD` on the location's clock. `location.whatsapp` is always `null` for now (no column).
- `GET /patient-api/appointments`: newest first, at most 300 rows, not paginated. `patientConfirmedAt` is `null` and `canConfirm` is `false` until M3-08.
- `GET /patient-api/visits`: only **completed** consultations (the linked queue entry has `status = 'completed'`); an in-progress visit is never shown. `diagnosis` and `treatments` are **omitted** (keys absent) for clinics with `patient_app.show_diagnosis` off. `page` max 10000, `limit` max 50.
- `GET /patient-api/prescriptions[/:id]`: only `FINALIZED`/`AMENDED` with `signed_at`; `issuedAt` = `signed_at`. **No `pdfUrl`** (the stored file is public and prints diagnosis/vitals). `hasPdf` = the clinic has `show_diagnosis` on.
- `GET /patient-api/prescriptions/:id/pdf`: same scoped lookup as the detail; `404 NOT_FOUND` when out of scope or the clinic has `show_diagnosis` off; renders the PDF per request and streams it (`application/pdf`, `attachment`, `Cache-Control: private, no-store`) — no URL is ever handed out. Writes an access-log `download` row.
- `GET /patient-api/billing/summary`: clinics with `show_billing` off are absent; cancelled invoices are never shown or counted; per-invoice `status` is `paid | partial | unpaid | overdue` (overdue on the invoice's location day); each invoice also has `profileId` and the location `timezone` (show `issuedAt` on that clock); at most 50 newest invoices **per clinic** (one query per clinic), totals cover all. `*Minor` = decimal amount × 100.
- `profileId` filters (query) must be one of the account's profiles, otherwise `404 NOT_FOUND`. `:id` not visible through the account's links → `404 NOT_FOUND`.
- Each successful list/detail read writes `patient_access_log` (`view_list` one row per distinct clinic patient, `view_detail` with `resource_id`); the write is best effort.

### 6.6 Profiles, links and account deletion as built (M2-10, M2-11)

- **Profiles.** `GET` lists self first then oldest first; links are active + frozen only and a clinic that was never approved is hidden (A-19). `POST`: `relation` ∈ child/parent/spouse/other (`self` is created by sign-up or the first claim), `dob` a real past `YYYY-MM-DD`, at most 20 profiles per account (`409 TOO_MANY_PROFILES`). `PATCH`: omitted = unchanged, `null` clears `dob`/`gender`; the self profile cannot change relation (`400 SELF_RELATION_FIXED`). `DELETE`: not self (`400 CANNOT_REMOVE_SELF`), not while the profile has an active/frozen link (`409 PROFILE_HAS_LINKS`: unlink first); it is a **soft delete** (A-22: `deleted_at`, name / dob / gender stripped, revoked link rows kept) and every profile query excludes deleted profiles. `POST` and the claim accept lock the account row (`FOR UPDATE`, 404 if deleted) so they cannot interleave with an account deletion. A profile id that is not the account's → `404 NOT_FOUND`. Profile data is the patient's own; it never touches the clinic record.
- **Links.** `GET /links` returns live links first, then revoked ones (history, max 200); each has `location` (the patient's primary location, else the main branch), `revokedAt`, `revokedBy` (`patient`/`clinic`/`system`). `DELETE /links/:id` is the patient-side revoke: allowed for a frozen link and when the clinic switched the app off; in one transaction it sets `revoked_by_type='patient'`, writes `patient_access_log` (`unlink`), a clinic-visible `audit_logs` row (`patient_app_link`) and the `patient.link_revoked` realtime event. A link that is not the account's, or already revoked → `404`. `GET /links/:id/history` is derived from the link row.
- **Delete account** (`DELETE /me`, rate limit 5 / 15 min, body `{ confirm: 'DELETE' }` exactly): one transaction — revoke every active/frozen link as in an unlink (reason `account_deleted`), soft-delete the profiles (A-22; the revoked link rows are **kept**), **delete `patient_account_identities`** and the email's login codes, revoke all sessions and null their `ip` / `device_label`, null the IP of the consent rows (rows stay), soft-delete the account (`status='deleted'`, name/phone/email stripped) and write a platform audit row (ids only). `patient_access_log` keeps the account id. Signing up again with the same email or Google account creates a brand-new account. Irreversible. Reminder / dose tables (M3) hang off profiles and are deleted with them. `DELETE /links/:id` is rate limited (30 / 15 min). Patient-side revokes are audited with actor side `system` (no `patient` side in the enum); the account id is in the audit `after`.
- Mobile: Family P-04 `(patient)/(main)/(tabs)/family.tsx` + `profiles/[profileId].tsx`; Linked clinics P-08 `clinics/index.tsx`; Delete account P-09 `account/delete.tsx`.
### 6.5 Medications as built (M3-01 / M3-02) — notes

- **Schedules are created by the backend**, never by the app: when a prescription is finalized (`PrescriptionService.finalize()` publishes the in-process `prescription.issued` event after its own work; the subscriber runs off the request and never fails it) every profile with an **active** link to that clinic patient (clinic `patient_app` feature on) gets one `MedicationSchedule` per medicine line. Revoked / frozen links get none. An amended + re-finalized prescription **updates in place** (lines matched by id, then by name; removed lines → `status: 'stopped'`; new lines added). A schedule the patient edited (PATCH) keeps its times / end date / status. The app is told with realtime `feed.changed { kinds: ['medications'] }` (room `patient:<accountId>`).
- Defaults: `frequency_timing` tags (`morning` 08:00, `noon`/`afternoon` 14:00, `evening` 20:00, `night`/`bedtime` 22:00; unknown tags ignored) else the `frequency` text (`OD`/`BD`/`TDS`/`QID`, `1+0+1`, `1-1-1`, "twice a day", q8h, Roman-Urdu / Urdu "din mein do baar", …; 1×=08:00, 2×=08:00+20:00, 3×=08:00+14:00+20:00, 4×=08:00+13:00+18:00+22:00). `SOS`/`PRN`/unparseable → `times: []` (the app shows the medicine with no reminders). `duration` ("5 days", "1 week", "10 din", "1 month", "5-7 days" → the larger) → `endDate` = start day + days − 1, `endDateSource: 'parsed'`; otherwise `endDate: null`, `endDateSource: 'unknown'`. `startDate` = the issue day on the clinic location's clock.
- `GET /medications` → `{ items, nextUpdatedSince }`: all statuses (including `stopped`, so the app can cancel reminders), **oldest change first** (`updated_at, id` ascending), ≤ 500 per call. When more exist `nextUpdatedSince` is the `updatedAt` of the last item — pass it as `updatedSince` for the next page (inclusive `>=`, so re-delivered rows are possible; replace by id); `null` = nothing more. Optional `profileId` (must be the account's, else 404). `clinic` is `null` when the clinic is not visible. Schedules the clinic cut off (A-23) are omitted from a call without `updatedSince`; with `updatedSince` they come back once as `stopped`.
- **Read-only (A-23):** `PATCH` on a prescription schedule whose profile has no active link to that clinic (patient left, link frozen, patient app off) → 403 `PATIENT_APP_DISABLED`; on a clinic-revoked (hidden) schedule → 404. Dose events can still be recorded. `PATCH` and `POST dose-events` are rate limited (120 / 15 min).
- **Weekly / alternate-day wording** ("once weekly", "every other day", "har doosre din", "hafte mein ek baar", …) yields **no default times** (`times: []`, patient sets them) — never a daily default.
- **Missed syncs are repaired**: every sync stamps `prescription_version`; a sweep (on boot + every 5 min, prescriptions finalized in the last 14 days) re-runs the idempotent sync for any active-linked profile whose schedules are missing or behind the prescription's `version`. The event feed hint `feed.changed` carries `medications`; a clinic revoke sends `['links','medications']`.
- `status: 'completed'` is **not set by the backend yet**: the app treats `endDate < today` (phone clock) as finished; a server sweep that flips it is a follow-up.
- `PATCH /medications/:id`: only `times` (`HH:mm` 24 h, ≤ 12, de-duplicated and sorted; `[]` turns reminders off), `endDate` (`YYYY-MM-DD`, real date, not before `startDate`; `null` = "no end date" chosen by the patient) and `status` (`active|paused|stopped`). Setting `endDate` (a date or null) sets `endDateSource: 'patient'` — **the app asks for an end date only when `endDateSource === 'unknown'`**. Any other key → 400; empty body → 400 `NOTHING_TO_UPDATE`; bad date → 400 `INVALID_END_DATE`. `completed` is never settable by the patient.
- `GET /medications/dose-events`: `from` < `to` required (UTC instants, window ≤ 92 days, else 400 `INVALID_RANGE` / `RANGE_TOO_LARGE`), optional `profileId`; ≤ 5000 rows.
- `POST /medications/dose-events`: 1–200 events; **one schedule id not owned by the account → 404 for the whole batch (nothing written)**; `actedAt` more than 24 h in the future → 400 `INVALID_EVENT_TIME`. Duplicates in the batch collapse to the latest `actedAt`; the DB upsert on `(schedule_id, due_at)` only overwrites when the stored `acted_at` is ≤ the new one, so replays and out-of-order syncs are safe. `accepted` = number of events received.
- Schedules belong to the **profile**: visible after the patient unlinks (read-only, see above). No `patient_access_log` rows are written for these routes.

### 6.3 Public visit page — `GET /visit/:token/state` (`@Public`, rate-limited, M3-05)

`{ clinicName, locationName, token, status, peopleAhead, nowServingToken, updatedAt }` — **no names**.

## 7. New: patient realtime `/patient-realtime` (M3-05)

- Connect with `auth: { token: <patient access> }`, verified with `JWT_PATIENT_ACCESS_SECRET` + `aud`.
- Server joins `patient:<accountId>`. Client may `subscribe { room: 'entry:<entryId>' }` only for an
  entry whose patient is in its active links (ack `{ ok:false, error:'NOT_FOUND' }` otherwise).
- Who may subscribe: an entry of a patient in the account's **active or frozen** links (A-19: frozen/suspended clinics stay readable) at an approved clinic. **Finished entries (completed, cancelled …) may be subscribed too** — it is the patient's own data; they simply stop receiving changes. The check runs on every `subscribe` and again when a `links` change arrives (rooms of unlinked entries are left).
- Lifetime: a socket is closed (`auth_error`) when its access token expires — the client reconnects with a fresh token — when its session is revoked on this instance (logout, refresh-token reuse, account deletion), and on any `subscribe` whose session is no longer alive. At most 5 sockets per account; the oldest is dropped.
- Availability: when the realtime bus is down the server sends `unavailable { retryAfterSeconds }` and disconnects. This is NOT an auth failure: keep the session, poll, and reconnect later. Only `auth_error` means "refresh the token / sign in".
- Events: `visit.event` `{ entryId, seq }` → refetch `/patient-api/queue/active`;
  `feed.changed` `{ kinds: ('medications'|'appointments'|'links')[] }` → invalidate those keys.
- Fed by the existing queue outbox relay (no new mutations in `QueueOrchestrator`).

## 8. Push contract

Expo push via `expo-server-sdk` (backend dep), provider `notifications/delivery/expo-push.provider.ts`
implementing `ChannelProvider` (`src/notifications/delivery/channel-provider.ts:36`).

```json
{
  "to": "ExponentPushToken[…]",
  "title": "Patient checked in",
  "body": "Ali · Token A-012",
  "channelId": "queue",
  "data": { "space": "staff", "type": "queue.patient_checked_in", "route": "/queue/doctor",
            "organizationId": "…", "locationId": "…", "entityId": "…" }
}
```

- Receipts: `DeviceNotRegistered` → delete that device row. Other errors → `PermanentSendError` / retry per dispatcher rules.
- New channel `push` (enum + DB CHECK + `CHANNELS_BY_AUDIENCE` + `CHANNELS_BY_RECIPIENT` + spec update).
- New outbox status `skipped_no_device` (enum + DB CHECK).
- `EnqueueInput.scheduledFor?: Date` (dispatcher already honours `scheduled_for`; final value =
  max(scheduledFor, quiet-hours decision)).

New events (seed `src/notifications/seeds/notification-events.seed.ts`):

| Code | Audience | Channels | Push text | Task |
| --- | --- | --- | --- | --- |
| `queue.patient_checked_in` (exists) | doctor | + push | "Patient checked in" / "{first_name} · Token {token}" | M1-04 |
| `queue.turn_near` | patient | push | "Your turn is near" / "{clinic_name}: {people_ahead} ahead of you" | M3-07 |
| `queue.called` | patient | push | "It's your turn" / "Please go to {doctor_name}" | M3-07 |
| `appointment.reminder` | patient | push | "Appointment tomorrow" / "{clinic_name} at {time}" | M3-07 |
| `prescription.issued` | patient | push | "New prescription" / "From {clinic_name}" | M3-07 |
| `patient.record_linked` | patient | push (+ email) | "Record linked" / "{clinic_name} linked a record to your account" | M2-04 |
| `patient.link_revoked` | patient | push | "Record unlinked" / "{clinic_name} removed a link" | M2-04 |

**M2-04 status:** both link events are published as a realtime outbox row (`topic = patient:<accountId>`, payload
`{ type: 'feed.changed', kinds: ['links'], event, linkId }`, ids only) in the link/revoke transaction (`patient-links/patient-link-events.ts`).
The push/email delivery rows above are **not built**: the notification catalog has no patient channel yet (`CHANNELS_BY_AUDIENCE.patient = []`), so they land with M3-07.
