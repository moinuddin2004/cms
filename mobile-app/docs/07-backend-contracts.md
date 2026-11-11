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
`ACCOUNT_DISABLED`, `SESSION_INVALID` (refresh).
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
| DELETE `/patient-api/me` | `{ confirm: 'DELETE' }` | `{ deleted: true }` — revokes sessions, links (status revoked), deletes profiles/schedules/dose events/devices; keeps `patient_access_log` (account id kept, PII removed) | M2-11 |
| GET `/patient-api/claims/:token` | — | `{ clinic: ClinicRef, location: { name }, maskedName, ageBand, isMinor, alreadyLinkedToYou }` | M2-04 |
| POST `/patient-api/claims/:token/accept` | `{ relation, profileId? , newProfileName? ≤150, confirm: true }` | `{ link, profile }` | M2-04 |
| GET `/patient-api/profiles` | — | `Profile[]` `{ id, relation, fullName, dob, gender, isSelf, links: { id, clinic, location, linkedAt }[] }` | M2-10 |
| PATCH `/patient-api/profiles/:id` | `{ fullName?, dob?, gender? }` | `Profile` | M2-10 |
| GET `/patient-api/links` | — | `{ id, profileId, clinic, location, status, linkedAt, linkMethod, linkedByLabel }[]` | M2-11 |
| DELETE `/patient-api/links/:id` | — | `{ revoked: true }` | M2-11 |
| GET `/patient-api/links/:id/history` | — | `{ at, action, label }[]` (linked, unlinked, revoked by clinic) | M2-11 |
| GET `/patient-api/appointments` | `from?` (UTC), `to?`, `profileId?` | `{ id, profileId, clinic, location, doctorName, startTime, endTime, status, type, patientConfirmedAt, canConfirm }[]` | M2-08 |
| POST `/patient-api/appointments/:id/confirm` | — | appointment | M3-08 |
| GET `/patient-api/visits` | `profileId?`, `page`, `limit` | paged `{ id, profileId, clinic, location, date (YYYY-MM-DD), doctorName, followUpDate, diagnosis? , treatments?: string[] }` | M2-08 |
| GET `/patient-api/prescriptions` | `profileId?`, `page`, `limit` | paged `{ id, profileId, clinic, location, doctorName, number, issuedAt, medicinesCount, hasPdf }` | M2-08 |
| GET `/patient-api/prescriptions/:id` | — | above + `medicines: { name, nameUrdu, type, dosage, frequency, frequencyTiming: string[], mealRelation, duration, instructions, instructionsUrdu }[]`, `pdfUrl` | M2-08 |
| GET `/patient-api/billing/summary` | `profileId?` | `{ clinic, currency, billedMinor, paidMinor, balanceMinor, invoices: { id, number, issuedAt, totalMinor, paidMinor, balanceMinor, status }[] }[]` (only clinics with `show_billing`) | M2-08 |
| GET `/patient-api/queue/active` | — | `{ entryId, profileId, clinic, location, token, status, doctorName, peopleAhead, nowServingToken, serviceDate }[]` (today, active statuses) | M3-05 |
| GET `/patient-api/medications` | `updatedSince?` | `MedicationSchedule[]` | M3-02 |
| PATCH `/patient-api/medications/:id` | `{ times?: string[], endDate?: string \| null, status?: 'active'\|'paused'\|'stopped' }` | `MedicationSchedule` | M3-02 |
| GET `/patient-api/medications/dose-events` | `from`, `to` (UTC) | `{ scheduleId, dueAt, action, actedAt }[]` | M3-02 |
| POST `/patient-api/medications/dose-events` | `{ events: { scheduleId, dueAt, action: 'taken'\|'skipped', actedAt }[] }` (≤200) | `{ accepted: number }` — upsert on `(schedule_id, due_at)`, latest `actedAt` wins | M3-02 |
| POST `/patient-api/devices` | `{ expoPushToken, platform, deviceLabel?, appVersion }` | `{ id }` | M3-07 |
| DELETE `/patient-api/devices` | `{ expoPushToken }` | `{ deleted }` | M3-07 |

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

### 6.3 Public visit page — `GET /visit/:token/state` (`@Public`, rate-limited, M3-05)

`{ clinicName, locationName, token, status, peopleAhead, nowServingToken, updatedAt }` — **no names**.

## 7. New: patient realtime `/patient-realtime` (M3-05)

- Connect with `auth: { token: <patient access> }`, verified with `JWT_PATIENT_ACCESS_SECRET` + `aud`.
- Server joins `patient:<accountId>`. Client may `subscribe { room: 'entry:<entryId>' }` only for an
  entry whose patient is in its active links (ack `{ ok:false, error:'NOT_FOUND' }` otherwise).
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
