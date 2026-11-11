# 03 — Security and privacy rules

> These rules are **non-negotiable**. A review fails on any violation, regardless of how good the
> rest of the change is. When a rule and a task card disagree, the rule wins — write it in the
> handoff note.

## 1. Threat model in one table

| Threat | Wall |
| --- | --- |
| Patient token used on a staff route | Different secret (signature fails) + `aud` check + `PatientFenceGuard` |
| Staff token used on a patient route | Patient strategy uses the patient secret + `aud: 'patient'` |
| Patient reads another clinic's / another patient's data | `PatientLinkGuard`; ids only from `request.patientContext`; isolation e2e tests |
| A developer forgets a guard on a new patient route | `PatientFenceGuard` + `patient-api-coverage.spec.ts` + route-matrix e2e in CI |
| Staff member links a patient's record to their own phone | Separate permission `patients.app_link.manage`, audit log, push to the previously linked account, owner report |
| QR photo forwarded | Token 15 min, single use, needs an account, staff sees "claimed by <masked email>" |
| Lost / shared phone | Refresh token in SecureStore `THIS_DEVICE_ONLY`; app PIN/biometric (V1); remote session revoke |
| PHI on lock screen | Push text rule (§5) |
| PHI left on disk | Encrypted MMKV for cached data; wiped on sign-out of that space |
| Mobile code in one space reading the other's token/cache | Import fences (lint) + separate stores + separate SecureStore keys |

## 2. Mobile rules

1. **Tokens**: access tokens live only in memory (Zustand). Refresh tokens only in SecureStore with
   `keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`. Keys: `auth.refreshToken` (staff),
   `patient.refreshToken` (patient). Never log, toast, persist, or put a token in a URL.
2. **No cross-space imports** (lint). A file in `src/patient/**` that imports `@/staff/**` is a
   blocker even if lint was disabled for it. `eslint-disable` for the fence rules is forbidden.
3. **No tenant headers from the patient client.** The patient axios client must not have an
   `x-organization-id` / `x-location-id` header code path at all.
4. **Never trust an id from a deep link or push payload** for authorisation. They are only
   navigation hints; the server re-checks everything.
5. **Persist only allow-listed queries** into the *encrypted* MMKV instance of that space. The
   encryption key is random (32 bytes from `expo-crypto`), stored in SecureStore
   (`<space>.cacheKey`). Sign-out of a space: clear its query cache, delete its MMKV instance,
   delete its cache key, delete its refresh token, unregister its push device.
6. **Prefs MMKV (unencrypted)** may hold only: active space, last tab, theme cache (colours, logo
   URL), dismissed tips, language. Never names, phone numbers, ids of patients, or anything else
   from the API.
7. **Logs**: no `console.log` of API responses, tokens, or patient data. Use `core/log.ts`
   (`log.debug` is stripped in release; `log.error` sends only error name/code/route, never the
   payload).
8. **Screenshots / app switcher**: patient space and staff patient-detail screens are fine to
   screenshot (user's own data / staff device policy). No blocking in MVP — revisit with
   biometric lock in V1.
9. **Clipboard**: never copy PHI automatically. Copy actions are explicit and show a toast.
10. **WebView**: none in MVP. Open external links with `expo-web-browser` only. Exception: store intents
    (`market://`, App Store URL) via `Linking.openURL`.
11. **Deep links**: `claim/[token]` validates the token format (base64url, 43 chars) before any
    network call; a malformed token shows "This link is not valid" — never echoes it.

## 3. Backend rules for the patient space

1. All patient routes live in `backend/src/patient-app/**` (and `patient-auth/**`) and carry
   `@PatientApi()` (except `/patient-auth/*` pre-login routes, which are `@Public()` + rate limited).
2. A patient service **never** accepts `organizationId`, `patientId`, `profileId` from the client
   without checking it against `request.patientContext`. Use `linkedPatientWhere(qb, ctx, profileId?)`.
   An id that is not linked returns **404** (not 403 — do not reveal existence).
3. Return explicit DTOs built field by field. Never return an entity, never spread an entity
   (`{...row}`), never return internal columns (`created_by`, cost, commission, notes flagged
   internal, audit fields).
4. Visibility rules (what a patient may see) are in [07 §3](07-backend-contracts.md#3-patient-visibility-rules).
   Clinical notes and internal comments are **never** exposed.
5. Patient JWT: secret `JWT_PATIENT_ACCESS_SECRET` (required at start-up when the patient module
   is enabled — throw if missing or equal to `JWT_ACCESS_SECRET`), `aud: 'patient'`, 15 min.
   Refresh tokens: opaque, 32 random bytes, stored **hashed** (sha256) in `patient_sessions`,
   rotated on every refresh; reuse of a rotated token revokes the whole session (theft signal).
6. Email login codes: 6 digits, 10 min, max 5 attempts per code, stored hashed, rate limited per
   email and per IP. Generic responses ("If this email can receive a code, we sent one").
7. Claim tokens: 32 random bytes base64url, stored as sha256, 15 min, single use, rate limited.
   Wrong/expired/used → one generic error code `CLAIM_INVALID`.
8. Every patient read of clinical data writes `patient_access_log` (batched insert is fine).
   Link/revoke actions write the existing staff audit log.
9. Socket `/patient-realtime` verifies the patient secret; `/realtime` must reject patient tokens
   (it already will, because the secret differs — add a test).
10. Errors follow the global exception filter shape; never include stack traces or SQL.

## 4. Staff space rules

- Never check role names. `useAccess().can('perm')` in UI; backend `@Can`.
- A screen hidden by `can()` is a UX nicety, not security: the API enforces the same permission.
- The staff app never shows data from a location other than the active one unless the API returns
  it for that location (no client-side cross-location merging).

## 5. Notifications privacy (A-14)

| Kind | Allowed in title/body | Not allowed |
| --- | --- | --- |
| Staff remote push | Patient **first name** + token number, generic event text ("Patient checked in") | Full name, phone, diagnosis, amounts |
| Patient remote push | Clinic name, time, generic text ("Your turn is near", "New prescription from Clinic X") | Medicine names, diagnosis, amounts, other family members' names |
| Patient local reminder | Profile first name + medicine name + dose (it is generated on the device by the owner) — unless the user enabled "Private reminders" (then "Medicine reminder for Ali") | Diagnosis |

## 6. Store and legal checklist (owner: architect + user, before M4)

- In-app account deletion (patient) + web URL for Google Play.
- Privacy policy + patient terms (+ Urdu), consent versions stored in `patient_account_consents`.
- Google Play Data safety + health apps declaration; data not used for ads; no third-party
  analytics SDK receives health data (we use our own `product_events`).
- Demo accounts for review: one staff, one patient, seeded demo clinic.

## 7. Security tests that must exist (and stay green)

| Test | Where | Task |
| --- | --- | --- |
| `patient-api-coverage.spec.ts`: every handler under `src/patient-app/**` has `@PatientApi()` (or `@Public` + rate limit in `patient-auth`), and none outside does | backend unit | M0-09 / M2-03 |
| Route matrix e2e: every non-patient route rejects a patient token; every `/patient-api` route rejects a staff token | backend e2e | M0-09 skeleton, M2-03 full |
| Strategy unit tests: staff rejects `aud: 'patient'` and patient-secret tokens, and vice versa | backend unit | M2-02 |
| Link isolation e2e: account A cannot read account B's profile/patient or an unlinked org (404) | backend e2e | M2-03 |
| Socket auth: patient token on `/realtime` → error; staff token on `/patient-realtime` → error | backend e2e | M3-05 |
| Mobile: lint fence test (a fixture import across spaces fails lint) | mobile, CI script | M0-02 |
| Mobile: sign-out of a space wipes its cache/key/token, leaves the other space intact | mobile unit | M2-06 |
