# DentalFlow Mobile App — Final Use Cases & Feature Plan

Nov 11, 2026 · @moin

**Ek app, do alag spaces; staff pehle (hafta 12), patient pilot hafta 32 par; patient ka primary hook nuskhe se khud banne wali family "Aaj" list hai.** Yeh sirf planning hai, koi application code nahi badla. Assumption: ek developer AI ki madad se; tamam estimates isi ke liye hain.

| Sawal | Faisla |
| --- | --- |
| App | Ek binary, `(staff)` aur `(patient)` route groups. Alag identity tables, alag JWT secret + `aud`, alag guards, alag API client |
| Core | Account, Profile, Link: ek patient account kai clinics ke `patients` rows se reception ke QR se jurta hai. Clinic ko doosri clinic ka data kabhi nahi milta |
| Daily use | Sach: dental patient roz nahi kholega. Hook = dose/care reminders jo nuskhe se khud bante hain (local notification, offline) + apni/walidain ki rozana dawa. Install trigger = live token. Uninstall rokne wali cheez = family wallet |
| CUT | Water/steps/sleep tracker, health journal, caregiver task assignment, phone par teeth chart edit |
| V2 | AI assistant, online payment, care plans, public booking, waitlist, full offline |
| OTP | Abhi koi SMS/WhatsApp provider nahi. MVP mein claim clinic ki in-person tasdeeq se (staff QR, 15 minute) |
| ChatGPT estimate | 16 se 22 hafte ek developer ke liye kam hain; MVP 32 hafte, V1 mazeed taqreeban 32 |
| Sab se bara risk | Product nahi, process: reception QR offer kare ya nahi |

ChatGPT ki PRD v1.0 baad mein mili aur section 1 mein us ke khilaf alag table hai. PRD parhne se koi verdict nahi badla; us ki 6 cheezein code se takrati hain.

## 1. Verification: proposal vs. asal repo

**PRD ab mil gayi hai:** pehli table brief ke proposals ko code ke khilaf check karti hai; is section ke aakhir mein "PRD v1.0 ke khilaf" table PRD ke apne text ko section-ba-section check karti hai.

Neeche har row **verified in code** hai jab tak alag na likha ho. Paths `cms/` ke relative hain.

| Proposed item | Maujood? | File path | Verdict |
| --- | --- | --- | --- |
| Do alag apps | Nahi; ek Expo app | `mobile-app/` (SDK 58, `src/app`) | Aap ka faisla: ek app, do spaces. Section 3 |
| `tenant_id` naming | Ghalat | `backend/database/schema/02_tables.sql:89` | Asal column `organization_id` (entity mein `organizationId`). Har nayi table yahi use karegi |
| Guard chain 4 guards ka | Adhoora | `backend/src/app.module.ts:134-161` | Asal mein **7** `APP_GUARD` hain: RateLimiter, JwtAuth, EmailVerified, TenantContext, FeatureFlag, Access, Subscription. Patient design ko saton se guzarna hai |
| Token audience se staff/patient alag | Nahi | `backend/src/auth/strategies/jwt.strategy.ts`, `auth/jwt.service.ts:23-36` | JWT mein `aud` ya `type` ka koi check nahi; payload `{sub, email, globalRole, sessionId, amr, hd}`. Naya banana hai |
| Patient login / portal | Nahi | `backend/src/patients/entities/patient.entity.ts:166-168` | Sirf ek unused `user_id` column aur retired flag `patients.portal`. **`user_id` use nahi karna**: woh patient ko staff `users` table se jorta |
| Global patient identity (phone se) | Nahi | `02_tables.sql:89-139` | `patients` org-scoped hai; phone unique nahi (`idx_patients_phone` plain index). Unique sirf `(organization_id, patient_number)` |
| Family / guardian tables | Nahi | `patient.entity.ts` | Sirf columns: `is_minor`, `guardian_name`, `guardian_phone`, `guardian_relation`. Family model naya hai |
| Follow-up / recall engine | Adha | `backend/src/patients/entities/patient-recall.entity.ts`; `encounters/entities/patient-encounter.entity.ts:102` | `patient_recalls` (due\_date, 3 reminder timestamps) aur `follow_up_date` maujood; scheduler/engine nahi. Extend karein, nayi table nahi |
| Medication reminders | Nahi | `backend/src/prescriptions/entities/prescription-medicine.entity.ts` | Data maujood: `frequency_timing` jsonb, `meal_relation`, Urdu naam. `dosage`, `frequency`, `duration` free text hain, is liye duration parse/normalise karna parega |
| Push notifications | Nahi | `backend/src/notifications/delivery/` | Device token table nahi; mobile mein `expo-notifications` install nahi |
| SMS / WhatsApp bhejna | Nahi | `notifications/delivery/dev-log.provider.ts` | Channels enum mein hain lekin sirf log hote hain. `ChannelProvider` interface (`channel-provider.ts:36`) naya provider lagane ki jagah hai |
| Patient ko notification | Band | `notifications/notifications.enums.ts:75` | `CHANNELS_BY_AUDIENCE.patient = []` aur spec isay guard karta hai (from docs: `docs/notifications-email-plan.md`, "Patients later"). `patient_comm_prefs` aur patient events (`payment.receipt`, `payment.outstanding_reminder`) pehle se hain |
| Health wallet / documents | Adha | `patients/entities/patient-document.entity.ts` | `is_visible_to_patient` flag pehle se hai. Wallet isi par banega |
| Treatment-plan acceptance | Adha | `patients/entities/patient-treatment-plan.entity.ts:115-118`; `treatment-plans.controller.ts:106` | `patient_accepted(_at)` + staff endpoint hai; patient-side endpoint nahi |
| Consent / signature | Haan | `patients/entities/patient-consent.entity.ts` | `signed_by_type`, `signature_url`, `consent_version` maujood. Reuse |
| Online / public booking | Nahi | `feature-flags/feature-catalog.seed.ts:22-35` | `appointments.online_booking` retired; `appointments` par source/channel column nahi |
| Waitlist | Nahi | not found | Naya |
| Online payment gateway | Nahi | `billing/entities/payment-account.entity.ts:11` | JazzCash/Easypaisa sirf account labels; koi integration nahi |
| Payment plans / installments | Nahi | not found | Balance computed hai (`billing/patient-billing/billing-reports.controller.ts`); installment entity nahi |
| Care plans / memberships | Adha | `billing/entities/credit-package.entity.ts`, `patient-credit.entity.ts` | Credit packages hain; care plan in par ban sakta hai |
| Live queue patient ke liye | Adha | `queue/controllers/display.controller.ts` | TV display `@Public()` hai, sirf location UUID se. Patient ka apna token view nahi |
| Realtime (mobile) | Backend haan, mobile nahi | `queue/realtime/queue.gateway.ts` | Namespace `/realtime`; mobile mein `socket.io-client` install hai lekin import nahi |
| AI assistant | Nahi | not found | Koi LLM code nahi |
| Patient feedback | Haan | `patients/entities/patient-feedback.entity.ts` | Reuse |
| Mobile release setup | Nahi | `mobile-app/app.json` | `eas.json` nahi, bundle id/package nahi, `expo-updates` nahi, name abhi `mobile-app` |

**Teen cheezein jo plan ko badalti hain:**

- **Socket gateway bina token ke connect hone deta hai** aur `location:<id>:display` room koi bhi join kar sakta hai (`queue.gateway.ts`). TV ke liye theek hai, lekin patient token ko isi gateway par nahi lana; patient ke liye alag namespace chahiye.
- **Socket aur JWT dono `JWT_ACCESS_SECRET` se verify hote hain aur sirf `sub` dekhte hain.** Agar patient token isi secret se sign hua to woh staff ke `user:<id>` room mein ja sakta hai. Patient tokens ka secret alag hona lazmi hai.
- **Appointments par reminder fields aur source column nahi.** Patient-side confirm/request ke liye schema change chahiye (section 8).

### PRD v1.0 ke khilaf

PRD docs se likhi gayi hai, code se nahi, aur khud section 17 mein manti hai ke us ki tables "proposed" hain. Us ka buniyadi usool sahi hai; tafseelat mein 6 jagah woh code se takrati hai aur 9 jagah maine us ka faisla badla hai.

**Code se takrao (verified in code):**

| PRD | PRD kya kehti hai | Asal code | Verdict |
| --- | --- | --- | --- |
| 17.1, 17.3, 17.4, 17.8 | Har table mein `tenant_id` | `organization_id` (`backend/database/schema/02_tables.sql`) | Ghalat naam. Har jagah `organization_id` |
| 17.9 | Nayi table `patient_consents` | **Isi naam ki table pehle se hai** (`02_tables.sql:3384`, clinic ki org-scoped consent) | Naam ka takrao. Meri table `patient_account_consents` hai |
| 17.5, 16, Phase 1 | `notifications`, `notification_deliveries`, `notification_preferences` tables aur "in-app notification system" banana | Sab pehle se hai: `notification_outbox` (`:1833`), `user_notifications` (`:3285`), `user_notification_prefs` (`:3273`), `patient_comm_prefs` (`:3253`), `notification_rules`, `notification_templates` | Dobara banana duplicate hai. Nayi sirf device tables + push provider |
| 18 | Base URL `/api/v1` | `backend/src` mein `setGlobalPrefix` ya `enableVersioning` nahi | Prefix maujood nahi. Routes root par hain |
| Phase 0, 21 | "Finalize database migrations" | Migrations nahi; hath se likhi SQL `schema/` + `changes/` (from docs: `CLAUDE.md`) | `changes/*.sql` scripts |
| 16, 13, 15.1 | "RBAC", "role checks", "role/permission-based navigation" | Sirf permissions: `ctx.can()` / `useAccess().can()`; role names code mein mana | Role ka lafz hata dein |

**Jahan maine PRD ka faisla badla:**

| PRD | PRD ka faisla | Mera faisla | Wajah |
| --- | --- | --- | --- |
| 14, 20, 24 | Do apps (`patient-app/` alag) | Ek app, do spaces | Aap ka faisla. PRD ki wajuhat (alag auth, nav, permissions) section 3 mein ek binary ke andar hal hain |
| 3.2, 4 | Follow-up engine P0, 5 tables + rule builder | V1, `patient_recalls` + `follow_up_date` par scheduler + staff call list | Patient tak pohanchne ka channel abhi nahi (push ko install chahiye, WhatsApp provider nahi). Rule builder pehle din over-engineering hai |
| 3.2, 10 | Health tracker P1, "major differentiator" | Water/steps/sleep CUT; BP/sugar reading log V2 | Phone pehle se karta hai. BP/sugar sirf manual dawa (P11) wale gharon ke liye maani rakhta hai |
| 3.2 | Multi-clinic records P2 | MVP ka core | Aap ka must-have. PRD ne isay sab se aakhir mein rakha tha |
| 17.1, 18.1 | `password_hash`, register/login/forgot-password, `phone` lazmi | Google, Apple, email code; password nahi; phone optional | Password reset ka poora flow bachta hai; phone verify karne ka provider nahi |
| 17.3 | `health_records` mein clinical data ki copy + `health_record_access_grants` (clinic ko doosri clinic ka data) | Copy nahi: links ke zariye live read. Cross-clinic grants nahi | Do copies ka matlab do sach. Clinic-to-clinic sharing sab se bara privacy risk hai |
| 17.2 | `family_groups` + `family_members` + `family_permissions`; user khud member add kare | `patient_profiles` (ek table); dependent sirf clinic jorti hai | Khud add karne se koi bhi kisi bache ka record claim kar sakta hai. Grants V2 |
| 9, 18.5 | Patient clinic/doctor dhoondhe, slots dekhe, direct book kare | Confirm + request only; discovery nahi | `no_doctor_overlap` aur booking rules staff ke liye hain; marketplace alag product hai |
| 13, 23 | Staff MVP mein nuskha likhna, camera uploads, follow-up tasks | V1 | Staff MVP queue par sabit hota hai; yeh teeno mil kar 6 hafte hain |

**PRD ki chhoti ghaltiyan:**

- `/patient/...` routes maujooda `/patients/...` staff routes se sirf ek harf door hain. `/patient-api/` saaf fence deta hai.
- `notification_devices.employee_id`: push aur socket rooms `users` par hain (`user:<id>`), employees par nahi.
- `medication_schedules.prescription_id`: schedule har dawa ka hota hai, is liye `prescription_medicine_id`. `frequency_timing` jsonb pehle se hai, alag `medication_schedule_times` table ki zaroorat nahi.
- `payment_intents.amount`: repo mein raqam `*_minor` columns mein hoti hai (from project notes; payments V2 hain).
- Staff stack mein Socket.IO "existing" likha hai: package install hai, import kahin nahi (`mobile-app/src`).
- AI ke liye LangChain + LangGraph + RAG: V2 mein bhi pehle ek sada "clinician-approved jawab" kaafi hai.

**PRD mein jo sahi hai aur plan mein shamil hai:** clinic record aur patient identity alag cheezein; dedicated patient guard + token audience; refresh token SecureStore mein, access token memory mein; client ke diye org id par bharosa nahi; medication stats "self-reported"; payment sirf verified callback se; AI aur payments baad mein.

**Timeline:** PRD Staff app ko 2 se 3 hafte deti hai (nuskha, camera, follow-ups samait) aur patient auth + claim + isolation ko 2 hafte. Ek developer ke liye mere andaze 10 aur 5 hafte hain (section 10).

## 2. Final use cases

Staff space ka usool: mobile par woh kaam jo chalte phirte hote hain (queue, patient dekhna, approve karna). Setup, billing entry, reports builder aur payroll web par hi rehte hain. Har story permission (`can()`) se gated hai, role ke naam se nahi; neeche actor sirf samjhane ke liye hai.

| Actor | Story | Tag |
| --- | --- | --- |
| Doctor | Apni aaj ki queue dekhna, agla patient bulana, consultation start/complete karna | MVP |
| Doctor | Patient ka summary dekhna: pichle visits, nuskhe, teeth chart (read-only), alerts | MVP |
| Doctor | Apne aaj/kal ke appointments dekhna | MVP |
| Doctor | "Patient aa gaya" / "lab result aa gaya" push milna | MVP |
| Doctor | Mobile se nuskha likhna (templates se) | V1 |
| Doctor | Clinical note + photo (camera se) patient documents mein | V1 |
| Doctor | Teeth chart edit, treatment plan banana | V2 (web/tablet ka kaam) |
| Receptionist | Patient search, quick register, walk-in token, check-in | MVP |
| Receptionist | Reception board (queue) dekhna aur reorder/skip | MVP |
| Receptionist | "Link app" QR dikhana; nuskha/receipt link WhatsApp par share | MVP |
| Receptionist | Patient ka QR scan kar ke check-in | V1 |
| Receptionist | Appointment book/reschedule | V1 |
| Receptionist | Payment collect + receipt | V1 |
| Receptionist | Internet band ho to check-in/token offline, baad mein sync | V2 |
| Coordinator | Follow-up/recall list: aaj kis ko call karni hai, outcome log karna | V1 |
| Coordinator | Patient ke reschedule requests approve/decline | V1 |
| Nurse | Queue mein patient ke vitals enter karna | V1 |
| Lab staff | Lab order ka status update, result photo upload | V1 |
| Owner | Aaj ka snapshot: patients, revenue, collection, queue, per location | MVP |
| Owner | Notifications/bell, location switch | MVP |
| Owner | Join requests, refunds/discount approvals | V1 |
| Owner | Reports dekhna (read-only, saved reports) | V2 |
| Owner | "Kitne patients ne app link ki" per staff | V1 |
| Patient | Clinic par QR scan kar ke apna record link karna | MVP |
| Patient | Doosri clinic ka record usi account mein jorna | MVP |
| Patient | Tamam clinics ke appointments, nuskhe, bills, visits ek jagah dekhna | MVP |
| Patient | Nuskhe se "Aaj" dose reminders khud ban jana; confirm/skip | MVP |
| Patient | Live token aur "bari qareeb hai" | MVP |
| Patient | Appointment confirm karna; reschedule/cancel **request** bhejna | MVP |
| Patient | Clinic ko call / WhatsApp (emergency button) | MVP |
| Patient | Account delete karna, kisi clinic ka link hatana | MVP (store rule) |
| Patient | Apni rozana dawa khud add karna; Ramzan timing | V1 |
| Patient | Treatment ke baad check-in ka jawab dena; Urdu audio hidayat | V1 |
| Patient | Lab reports/X-ray/documents dekhna, PDF share | V1 |
| Patient | Qist ki due date, balance dekhna | V1 |
| Patient | Appointment request bhejna (slot nahi, request) | V1 |
| Patient | Treatment plan estimate dekh kar accept karna | V1 |
| Patient | Online payment (JazzCash/Easypaisa/card) | V2 |
| Patient | AI se nuskha/report Urdu mein samajhna | V2 |
| Guardian | Bachon/dependents ko family mein add karna, un ke records dekhna | MVP (sirf clinic-attested) |
| Guardian | Family ke sab ke doses/appointments ek "Aaj" list mein | MVP |
| Guardian | Buzurg walidain ko dependent bana kar un ki dawa manage karna | V1 |
| Guardian | Bacha 18 ka ho to record us ke apne account mein muntaqil | V2 |
| Family member | Doosre adult ko read access dena (share with spouse) | V2 |

Do jagah maine aap ki wishlist se ikhtilaf kiya hai. Patient **slot book nahi karta**, sirf request bhejta hai: appointments module ka conflict logic (`no_doctor_overlap`) staff ke liye bana hai aur patient ke hath mein direct booking no-show aur spam barhati hai. Aur guardian MVP mein dependent khud nahi jor sakta, clinic jorti hai: warna koi bhi kisi bache ka record claim kar sakta hai.

## 3. Single-app architecture

**Recommendation:** ek binary, do mukammal alag spaces. Identity, tokens, secrets, API client, query cache aur backend guards sab alag; sirf UI kit aur helpers shared. App ek hai, lekin backend ke liye yeh do alag clients hain.

### 3.1 Login aur onboarding

- **Pehli screen ek sawal poochti hai:** "Main patient hoon" / "Main clinic staff hoon". Aakhri choice yaad rehti hai. Identifier se khud detect nahi karna: ek hi email dono taraf ho sakti hai, aur auto-detect se pata chal jata hai ke kaun sa email staff hai (enumeration).
- **Staff:** maujooda flow jaisa hai (`POST /auth/login`, Google, select-location). Staff sign-up app mein nahi.
- **Patient:** Google, Apple, ya email + code. Naye endpoints `/patient-auth/*`. Claim QR ka deep link seedha patient flow mein le jata hai.
- **Jo shakhs dono hai:** do alag identities, do alag sessions, ek sath zinda. Profile mein "Switch to Staff / Patient" button. Database mein dono ke darmiyan **koi link nahi**: staff `users` aur naya `patient_accounts` kabhi join nahi hote. Link hota to patient side ka bug staff privilege tak pohanch sakta tha.

### 3.2 Session aur token design

| Cheez | Staff space (maujooda) | Patient space (naya) |
| --- | --- | --- |
| Identity table | `users` | `patient_accounts` |
| Access token | JWT, `JWT_ACCESS_SECRET`, 15 min; **`aud: 'staff'` add karna hai** | JWT, **`JWT_PATIENT_ACCESS_SECRET`**, 15 min, `aud: 'patient'`, `sub` = patient account id |
| Refresh | Opaque, `SessionService`, header `x-refresh-token` (`auth/native-client.ts`) | Opaque, nayi `patient_sessions` table, header `x-patient-refresh-token`, endpoint `/patient-auth/refresh` |
| SecureStore key | `auth.refreshToken` (jaisa hai) | `patient.refreshToken` |
| Store | `useAuthStore` | `usePatientAuthStore` |
| API client | `src/lib/api.ts` (org/location headers) | `src/lib/patient-api.ts` (koi org header nahi; base `/patient-api`) |
| Query cache | Apna `QueryClient` | Apna `QueryClient` |

- **Alag secret asal deewar hai,** `aud` doosri. Patient token staff strategy mein signature par hi fail hota hai. `aud` is liye ke koi kal ghalti se secrets ek kar de to bhi check rahe.
- **Staff `aud` rollout:** `jwt.strategy.ts` pehle `aud` ke baghair token bhi qabool kare, ek release baad lazmi kar dein. Access token 15 minute ka hai, is liye purane tokens khud khatam ho jate hain.
- **Space switch:** logout nahi hota. Sirf `activeSpace` badalta hai (`useSpaceStore`, non-secret). Doosre space ka cache memory mein rehta hai lekin us ka UI mount nahi hota. V1 mein staff space mein wapsi par biometric lock.
- **Logout:** per space; sirf us space ka refresh token aur cache saaf. "Sab se logout" dono saaf karta hai.

### 3.3 Backend separation

&#91;embedded content: request ke do raste · staff (maujooda) aur patient (naya)\]

Dono raste alag secret, alag guards aur alag controllers se guzarte hain; sirf database mushtarka hai, aur patient wahan sirf apne links ke zariye pohanchta hai.

- **Route fence:** tamam patient endpoints `/patient-api/*` ke neeche, module `src/patient-app/`. Controllers par ek composite decorator `@PatientApi()` jo teen kaam karta hai: `@Public()` metadata (taake `JwtAuthGuard` aur `TenantContextGuard` skip karein, jaisa TV display controller pehle se karta hai), `IS_PATIENT_API` metadata, aur `@UseGuards(PatientJwtGuard, PatientLinkGuard)`.
- **`PatientFenceGuard` (naya, `APP_GUARD` mein sab se pehle):** path `/patient-api/` se shuru ho aur handler par `IS_PATIENT_API` na ho to 403; ulta bhi 403. Is se "`@Public()` laga diya, guard bhool gaya" wali ghalti production tak nahi pohanchti.
- **`PatientJwtGuard`:** alag passport strategy `patient-jwt`, alag secret, `aud === 'patient'`, `patient_sessions` mein session zinda.
- **`PatientLinkGuard`:** token ke account se active links nikal kar `request.patientContext = { accountId, links: [{ organizationId, patientId, relation }] }` banata hai. Har query patient ids **yahin se** leti hai, request params se kabhi nahi. Jis org ka `patient_app` feature band hai us ke links read-only hote hain.
- **Assumption (verify karna hai):** `EmailVerifiedGuard` aur `SubscriptionGuard` `@Public()` routes ko chhor dete hain. TV display endpoint isi chain se bina login guzarta hai, is liye ghalib hai; phir bhi pehle din test se sabit karna hai.
- **Realtime:** patient ke liye alag namespace `/patient-realtime`, patient secret se verify, rooms `patient:<accountId>` aur `entry:<queueEntryId>` (sirf apni linked entry). Maujooda `/realtime` ko patient token `auth_error` deta hai kyun ke secret alag hai.

**Saboot (tests):**

| Test | Kya sabit karta hai |
| --- | --- |
| `patient-api-coverage.spec.ts` (`access-coverage.spec.ts` ki tarz par) | `src/patient-app/**` ka har handler `@PatientApi()` rakhta hai; bahar ka koi nahi |
| Route matrix e2e: Nest router se tamam routes nikal kar | Patient token se har non-patient route 401/403; staff token se har `/patient-api` route 401 |
| Strategy unit tests | Staff strategy `aud: 'patient'` aur patient secret dono reject karti hai; ulta bhi |
| Link isolation e2e | Account A ka token account B ke `patientId` ya ghair-linked org ka data mangay to 404 |
| Socket test | Patient token `/realtime` par `auth_error`; staff token `/patient-realtime` par `auth_error` |

Route matrix test CI mein lazmi hai. Yeh ek test "security UI par depend nahi karti" ka asal saboot hai.

### 3.4 Expo Router structure

```
src/app/
  _layout.tsx            root guards
  index.tsx              EntryRedirect
  offline.tsx
  claim/[token].tsx      deep link, patient flow
  (auth)/
    welcome.tsx          staff ya patient?
    staff-login.tsx      maujooda login.tsx
    patient-login.tsx
  (staff)/               maujooda (app)/ ka naya naam
    _layout.tsx          AccessProvider + staff QueryClient
    select-location.tsx
    (tabs)/ queue, patients, appointments, more
  (patient)/
    _layout.tsx          patient QueryClient
    (tabs)/ today, family, visits, more
```

`Stack.Protected` rules, maujooda root `_layout.tsx` ke upar:

| Guard | Route |
| --- | --- |
| `status === 'unreachable'` | `offline` |
| Active space ka session nahi | `(auth)` |
| `space === 'staff' && staff.signedIn && mustSelect` | `(staff)/select-location` |
| `space === 'staff' && staff.signedIn && !mustSelect` | `(staff)` |
| `space === 'patient' && patient.signedIn` | `(patient)` |

- **Features:** staff features `src/features/<name>` mein rehte hain (jaisa `mobile-app/CLAUDE.md` kehta hai). Patient features `src/features/patient-<name>` (`patient-auth`, `patient-today`, `patient-wallet`, `patient-family`, `patient-queue`).
- **Boundary lint:** ESLint `no-restricted-imports`: `patient-*` features `@/lib/api`, `useAuthStore` ya staff features import nahi kar sakte; staff features `patient-api` nahi. Yahi rule baad mein split ko sasta rakhta hai.
- **Shared:** `components/ui`, `components/forms`, `components/feedback`, `lib/currency`, `lib/datetime`. Patient space mein har record apni location ka timezone sath lata hai; "active location" ka tasawwur wahan nahi hai.

### 3.5 Performance aur size

- **Sach:** native par ek hi JS bundle install hota hai; patient user ke phone mein staff code disk par hoga. Jo cheez control mein hai woh **evaluation** hai: staff screens tab tak load na hon jab tak staff space na khule. Metro ke inline requires aur Hermes bytecode isay sasta rakhte hain.
- **Verify karna hai (SDK 58 docs):** Expo Router ke async/lazy routes production native builds mein kis had tak support hain. Meri maloomat is version par pakki nahi.
- **Rule:** bhari staff-only libraries (charts, scanner) sirf `(staff)` ke andar import hon; root layout mein nahi.

| Target | Value |
| --- | --- |
| Cold start se interactive (3 se 4 GB RAM Android) | 2.5 second se kam |
| Android download size | 40 MB se kam |
| Patient "Aaj" screen, cache se | 500 ms se kam, internet ke baghair |

- **OTA:** `expo-updates` add karna hai (abhi nahi). Channels `production` aur `preview`. Store release mahine mein ek, JS fixes OTA se hafta-war, pehle 10% rollout.
- **Staged rollout:** server-side feature keys `mobile.staff` aur `patient_app` per org (maujooda feature-flags module). Ek `GET /app/min-version` endpoint force-update ke liye.

### 3.6 App store

- **Listing:** ek listing. Pehle 3 screenshots patient ke (store par wohi audience bari hai), agle 3 staff ke, description mein dono hisse wazeh. Naam abhi neutral rakhna hai (product name undecided).
- **Review risks jo mujhe maloom hain; current policy text aap ko khud check karna hai:**

| Risk | Kya karna hai |
| --- | --- |
| Dono spaces ke demo accounts | Seeded demo clinic + ek staff login + ek patient login review notes mein |
| Account deletion | Patient account app ke andar delete ho; Google Play ke liye web URL bhi. MVP mein shamil |
| Google login hai to Apple login | iOS par Sign in with Apple (ya barabar ka privacy-friendly option) dena parega |
| Health data | Apple privacy labels, Google Play Data safety + health apps declaration; data advertising ke liye use nahi |
| Staff login bina sign-up | Review notes mein likhna ke staff accounts clinic banati hai |
| Bachon ka data | App "Kids" category mein nahi; bachon ke records guardian ke account mein |
| AI assistant | Medical advice ke daway review ko sakht karte hain; V2 tak bahar rakhne ki ek wajah yeh bhi hai |

### 3.7 Future: branded app ya split

- **Branded clinic app:** theme tokens pehle se hain. `app.config.ts` mein `APP_VARIANT` + EAS build profile se naam, icon, bundle id aur ek locked organization set ho. Naya codebase nahi, naya build profile.
- **Do apps mein split:** agar 3.4 ka boundary lint qaim raha to split ka matlab hai do build variants jo doosre route group ko bundle se nikal dein. Andaza: 1 se 2 hafte, rewrite nahi.
- **Darwaza khula rakhne ki qeemat:** boundary lint, alag stores/clients, deep links mein space prefix (`/s/...`, `/p/...`). Teeno aaj taqreeban muft hain.

**Kya cheez split par majboor kar sakti hai:**

1. Store review dual-audience app ko baar baar reject kare.
2. Clinics staff app ke liye MDM/kiosk/tablet build mangein.
3. Staff features bundle ko 40 MB ya start ko 2.5 second se upar le jayein.
4. Staff ko fori hotfix chahiye ho aur patient-side review release ko rok rahi ho.
5. Kai clinics apne naam ki patient app mangein (tab patient side variant banti hai, staff side wohi rehti hai).

## 4. Multi-clinic universal patient account

**Core design:** teen alag cheezein. **Account** (login karne wala insaan, global), **Profile** (jis shakhs ka record hai: khud ya dependent, global), aur **Link** (ek profile ko ek clinic ke `patients` row se jorta hai). Clinic ka `patients` row jaisa hai waisa rehta hai aur `organization_id` se scoped rehta hai; global cheezein sirf us ki taraf ishara karti hain.

### 4.1 Identity model

| Table | Scope | Key columns | Indexes |
| --- | --- | --- | --- |
| `patient_accounts` | Global | `id`, `full_name`, `email`, `email_verified_at`, `phone`, `phone_verified_at`, `status`, `deleted_at` | unique `lower(email)` where not deleted; plain index `phone` |
| `patient_account_identities` | Global | `account_id`, `provider` (google / apple / email), `subject` | unique `(provider, subject)` |
| `patient_sessions` | Global | `account_id`, `refresh_token_hash`, `device_label`, `expires_at`, `revoked_at` | index `account_id`; unique `refresh_token_hash` |
| `patient_profiles` | Global | `account_id`, `relation` (self / child / parent / spouse / other), `full_name`, `dob`, `gender` | index `account_id`; unique `(account_id)` where `relation = 'self'` |
| `patient_record_links` | Pul (bridge) | `profile_id`, `organization_id`, `patient_id`, `status` (active / revoked / frozen), `link_method`, `verified_by_user_id`, `verified_at`, `revoked_at`, `revoked_by` | **unique `(patient_id)` where `status = 'active'`**; index `profile_id`; index `(organization_id, patient_id)` |
| `patient_claim_tokens` | Org | `organization_id`, `patient_id`, `token_hash`, `created_by_user_id`, `expires_at`, `used_at`, `used_by_account_id` | unique `token_hash`; index `(organization_id, patient_id)` |
| `patient_account_consents` | Global | `account_id`, `kind` (terms / privacy / whatsapp\_opt\_in / link), `version`, `organization_id` (link ke liye), `accepted_at`, `ip` | index `(account_id, kind)` |
| `patient_access_log` | Bridge | `account_id`, `profile_id`, `organization_id`, `patient_id`, `action`, `resource_type`, `resource_id`, `at` | index `(organization_id, patient_id, at)`; index `(account_id, at)` |
| `patient_devices` | Global | `account_id`, `expo_push_token`, `platform`, `last_seen_at` | unique `expo_push_token` |
| `medication_schedules` | Global (patient ki milkiyat) | `profile_id`, `source` (prescription / manual), `organization_id`, `prescription_medicine_id`, `name`, `dose_text`, `times` jsonb, `meal_relation`, `start_date`, `end_date`, `status` | index `(profile_id, status)`; unique `(profile_id, prescription_medicine_id)` |
| `medication_dose_events` | Global | `schedule_id`, `due_at`, `action` (taken / skipped), `acted_at` | unique `(schedule_id, due_at)` |

`patients.user_id` (unused) ko haath nahi lagana aur use nahi karna. Baad ki cleanup script mein drop.

`changes/` scripts (sirf naam):

- `YYYY-MM-DD_patient_accounts_sessions.sql`
- `YYYY-MM-DD_patient_profiles_links_claims.sql`
- `YYYY-MM-DD_patient_consents_access_log.sql`
- `YYYY-MM-DD_push_devices.sql` (`patient_devices` + staff `user_devices`)
- `YYYY-MM-DD_medication_schedules.sql`
- `YYYY-MM-DD_queue_visit_tokens.sql`
- `YYYY-MM-DD_appointment_patient_requests.sql`

Har ek ke sath `schema/02_tables.sql` ka block usi commit mein.

### 4.2 Claim flow

1. Staff (`patients.app_link.manage`) patient record par "Link app" dabata hai. Agar record pehle se linked hai to warning aati hai (masked email ke sath).
2. Backend `patient_claim_tokens` row banata hai: 15 minute, single use, sirf hash store. QR staff ki screen par (web ya staff app).
3. Patient scan karta hai: app installed hai to `claim/[token]` khulta hai, warna web page jo store par bhejta hai aur token deep link mein rakhta hai.
4. Patient account banata/login karta hai, phir confirm screen: clinic ka naam + record ka naam + "Yeh record kis ka hai?" (Main / mera bacha / walid ya walida / koi aur).
5. Link `active` hota hai, consent row likhi jati hai, staff audit log mein entry, aur account ke doosre devices ko "naya record link hua" push.

**Doosri clinic:** wohi flow doosri clinic ke reception par. Yahi "ek account, kai clinics" hai; koi automatic discovery nahi.

| Surat-e-haal | Faisla |
| --- | --- |
| Phone number se doosri clinics ke records khud dhoondhna | **MVP mein nahi.** Is se zahir ho jata hai ke koi shakhs kis clinic ka patient hai, aur phone ghar bhar ka hota hai. V1 mein verified phone (OTP) ke baad sirf "clinic X par record mil sakta hai, reception se link karwayein" ka ishara |
| CNIC se match | Key nahi. `patients.cnic` aksar khali hota hai. V1 mein sirf mismatch warning: account aur record dono par CNIC ho aur alag ho to staff ko dikhao |
| Ek clinic mein ek shakhs ke do `patients` rows | Dono ek hi profile se link ho sakte hain. Merge clinic ka kaam hai |
| Record pehle se kisi aur account se linked | Staff pehle purana link revoke kare (audit), phir naya token. Email badalne ya phone kisi aur ko dene ka yahi hal hai |
| Ghalat patient ka QR dikha diya | Staff revoke karta hai; `patient_access_log` batata hai kya dekha gaya |
| Naam/DOB record aur profile mein alag | Link hota hai lekin staff ko "mismatch" badge; clinic ka record clinic hi theek karti hai |
| 18 se kam umar ka record | "Main" ka option nahi aata; sirf dependent ke taur par |

### 4.3 Patient kya dekhta hai

| Data | Patient ko | Control |
| --- | --- | --- |
| Appointments (waqt, doctor, location, status) | Hamesha | Fixed |
| Nuskhe | Sirf signed/final | Fixed |
| Invoices, payments, balance | Default on | Clinic setting `patient_app.show_billing` |
| Visit ki tareekh, doctor, `follow_up_date` | Hamesha | Fixed |
| Diagnosis / treatment ka naam | Default on | Clinic setting `patient_app.show_diagnosis` |
| Documents, X-ray, lab reports | Sirf `is_visible_to_patient = true` | Per document (maujooda flag) |
| Treatment plan + estimate | Sirf jo staff "share" kare | Per plan |
| Clinical notes, internal comments, cost, commission, audit | Kabhi nahi | Fixed |

Settings `settings-registry` (`config_values`) mein jati hain, nayi table nahi. Patient clinic ka record edit nahi kar sakta; sirf apna profile aur apni manual dawaein.

**Clinic ko kya nazar aata hai:** sirf "app linked: haan, kab se". Kisi clinic ko doosri clinic ka data **kabhi nahi** milta. Universal account sirf patient ki aankhon ke liye hai.

### 4.4 Data ki milkiyat jab clinic chali jaye

- Clinical record ki zimmedar clinic hai. Account, profiles, manual dawaein aur dose history patient ki hain.
- **Subscription khatam:** link `frozen`, patient ko read-only access jab tak data database mein hai. `SubscriptionGuard` patient API par lagu nahi hota.
- **Clinic data delete karwaye:** patient ko 30 din pehle notice + nuskhon aur bills ka PDF download. Phir link ki jagah "yeh clinic ab platform par nahi".
- Yeh clinic ke terms of service mein likhna hai. **Assumption:** aap is policy se muttafiq hain (section 11, decision 3).

### 4.5 Consent aur audit

- Sign-up par terms + privacy ka version (`patient_account_consents`).
- Har link par patient ki confirm + staff ki tasdeeq.
- WhatsApp opt-in alag row; maujooda `patient_comm_prefs` per-clinic opt-out waise hi rehta hai.
- Patient ki har clinical read `patient_access_log` mein. Staff ke link/revoke actions maujooda audit log mein.
- Patient app mein "mera data kis ne link kiya, kab" dekh sakta hai.

### 4.6 Minors aur guardian

- 18 se kam: record sirf kisi adult account ke dependent profile se link hota hai. Staff reception par guardian ko maujooda `guardian_name` / `guardian_phone` / `guardian_relation` se milata hai.
- MVP: ek record, ek account (unique active link). Dono walidain ko access V2 mein (`patient_profile_grants`).
- Buzurg walidain: adult patient khud reception par maujood ho aur razamandi de; staff tasdeeq karta hai.
- 18 ka hone par (V2): jab woh khud apna QR claim kare to guardian ka link revoke ho jata hai.

### 4.7 Tenant isolation

- Patient API **staff controllers/services reuse nahi karti.** Woh `TenantContext` aur `ctx.can()` farz karte hain. `src/patient-app/` mein patle read-only query services, har ek explicit DTO ke sath (entity kabhi return nahi).
- Client se `organizationId` kabhi qabool nahi hota. Har query `request.patientContext.links` se `(organization_id, patient_id)` pairs le kar filter hoti hai. Ek helper `linkedPatientWhere(qb, ctx, profileId?)` yeh kaam ek jagah karta hai.
- Section 3.3 ka link isolation e2e isi ko sabit karta hai.

### 4.8 Abuse aur security risks

| Risk | Bachao |
| --- | --- |
| Staff khud ko QR de kar kisi patient ka record apne phone mein le le | Alag permission `patients.app_link.manage`, har link audit mein, purane linked account ko push, owner report "links per staff" |
| QR ki photo aage bhej di gayi | 15 minute, single use, account banana lazmi |
| Email par qabza ho gaya | Naye device par login ki notification; clinic revoke kar sakti hai |
| Claim endpoint par guessing | Token 128-bit random, sirf hash store, generic error, maujooda `RateLimiterGuard` |
| Ghar ka mushtarka phone | Optional app PIN/biometric (V1) |
| Patient API se doosre org ka data | `PatientLinkGuard` + isolation tests; params par bharosa nahi |
| WhatsApp link mein data leak | Links mein sirf single-use token; record ka koi data URL mein nahi |
| Queue ticket ka QR | Sirf "visit token": token number aur position, koi naam ya clinical data nahi. Record claim is se **nahi** hota |

## 5. Reason-to-open matrix aur chosen hook

**Seedhi baat:** dental patient ke paas koi daily medical need nahi hoti, aur koi feature isay badal nahi sakta. App uninstall is liye nahi hoti ke log roz kholte hain; is liye nahi hoti ke (a) us mein family ka aisa data hai jo kahin aur nahi milta, (b) koi kaam pending hai (dose, appointment, installment), aur (c) notification khud kaam le aati hai. Is liye hook "roz kholna" nahi, "roz ka kaam app khud yaad dilaye" hai.

**Primary hook (wedge): "Aaj" family care list.** Clinic ki prescription aur treatment se doses aur care tasks khud ban jate hain (zero typing), poori family ke liye ek list, phone ki local notification se (internet aur push provider ke baghair). User apni ya walidain ki rozana dawa (sugar, BP) bhi add kar sakta hai; yahi cheez dental course khatam hone ke baad bhi app ko daily rakhti hai.

**Supporting hook 1: Live token.** Reception par QR scan, apna token number, kitne log aage hain, "aap ki bari qareeb hai". Yeh install karwata hai, retain nahi karta.

**Supporting hook 2: Family health wallet.** Tamam clinics ka record, nuskhe, bills, reports ek jagah. Yeh uninstall rokta hai (stored value), rozana nahi khulta.

Daily use sirf teen segments mein realistic hai: ghar mein koi rozana dawa leta ho, braces/aligner ka patient, ya treatment ke baad 3 se 7 din ka course. Baqi sab ke liye target "uninstall na ho + event par khule" hai. Neeche har "evidence" column reasoning hai, measured data nahi; 90-day pilot (section 9) isi ko test karta hai.

| # | Reason to open | Kis ke liye | Frequency | Trigger | Pakistan reasoning | Effort | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | "Aaj" list: nuskhe se auto dose reminders | Patient, guardian | Daily (course ke dauran) | Local notification | Nuskha parchi kho jati hai; dose timing zabani batayi jati hai. Zero entry hamara farq hai | M | **MVP, primary hook** |
| R2 | Apni/walidain ki rozana dawa add karna (medicine cabinet) | Guardian, buzurg | Daily (hamesha) | Local notification | Sugar/BP ghar ghar; aulad walidain ki dawa manage karti hai. Generic apps mein family + clinic link nahi | S (R1 ke upar) | **V1** |
| R3 | Ramzan mode: doses sehri/iftar par shift | Patient | Daily (1 mahina) | Local notification | Har saal dose timing ka sawal aata hai; koi local app yeh nahi karti | S | **V1** |
| R4 | Live queue token + "bari qareeb hai" | Walk-in patient | Event-driven | QR at reception, web pehle, phir push | Walk-in + token culture, lamba intezar; log bahar/gaari mein wait karna chahte hain | M (queue + realtime bana hua hai) | **MVP, supporting** |
| R5 | "Doctor aaj baithe hain?" + current token | Patient | Event-driven | In-app, web link | Log abhi phone kar ke poochte hain; reception ka load kam | S | **V1** |
| R6 | Family health wallet (multi-clinic) | Patient, guardian | Rare, lekin high keep-value | In-app, WhatsApp link | Records kaghaz par; doosre doctor ko dikhane ke liye kuch nahi hota | L (section 4) | **MVP, supporting** |
| R7 | Appointment confirm / reschedule request | Patient | Event-driven | Push, WhatsApp link | No-show clinics ka sab se bara dard | S | **MVP** |
| R8 | Treatment ke baad check-in ("dard/soojan?") + Urdu audio hidayat | Patient | Event-driven (din 1, 3, 7) | Push / local | Post-op hidayat zabani; literacy kam, audio behtar | M | **V1** |
| R9 | Braces/aligner routine (tray change, elastics, monthly visit) | Ortho patient | Daily/weekly, 12 se 24 mahine | Local notification | Chhota segment, lekin sab se mehnga treatment aur sab se lamba rishta | M | **V1** |
| R10 | Installment due + balance | Patient, guardian | Monthly | Push, WhatsApp link | Ortho/implant qiston par hota hai; clinic ko recovery chahiye | M | **V1** (reminder only; online payment V2) |
| R11 | Digital clinic card: QR dikha kar check-in | Patient | Event-driven | In-app; staff app scan | Reception par naam/phone dhoondhna slow; staff app ko bhi kaam deta hai | S | **V1** |
| R12 | Follow-up / recall ("6 mahine ho gaye") | Patient | Rare (saal mein 2) | Push, WhatsApp | Clinic revenue ka seedha lever; patient ke liye open ka reason kam | M | **V1** (clinic value ke liye) |
| R13 | Bachon ki brushing routine + streak | Guardian, bacha | Daily (novelty 2 se 4 hafte) | Local notification | Free apps bohat; clinic reward se jorein to farq | S (R9 engine par) | **V2** |
| R14 | Family Health Command Center / daily inbox | Guardian | R1 ka UI hai, alag feature nahi | In-app | Naam bara, asal mein "Aaj" list hi hai | 0 | **Merge into R1** |
| R15 | Family caregiver task assignment | Family | Weekly | Push | Ghar mein WhatsApp group yeh kaam karta hai | M | **CUT** |
| R16 | Health journal / check-ins | Patient | Daily (koi nahi likhta) | In-app | Bina clinical use ke data; R8 structured version kaafi | M | **CUT** |
| R17 | Water/steps/sleep tracker | Patient | Daily | In-app | Phone aur ghari pehle se karte hain; dental se taluq nahi | M | **CUT** |
| R18 | AI assistant (nuskha/report samjhao, Urdu) | Patient | Event-driven | In-app | Value hai, lekin medical liability + cost; pehle data hona chahiye | L | **V2** |
| R19 | Family care plans/packages (clinic bechta hai) | Clinic, family | Rare | In-app, staff | Billing mein package/membership model chahiye; pehle demand sabit ho | L | **V2** |
| R20 | QR-based web portal (install se pehle) | Naya patient | Event-driven | QR, WhatsApp link | Log app install se pehle link kholte hain; yeh funnel ka pehla qadam hai | M | **MVP** (R4, R6 ka darwaza) |
| R21 | Emergency button: clinic ko call / WhatsApp (wa.me) | Patient | Rare | In-app | API ke baghair chalta hai; treatment ke baad sab se zaroori cheez | S | **MVP** |
| R22 | Bachon ka vaccination (EPI) schedule | Guardian | Event-driven | Local notification | EPI card kho jata hai; lekin dental scope se bahar | M | **V2** (general healthcare ke sath) |

### Staff space aur Patient space ek doosre ko kaise barhate hain

- **Checkout par claim:** receipt/nuskhe ke print par QR, aur staff app mein "Patient ko app do" button jo wohi QR dikhata hai. Patient install tab karta hai jab reception kehti hai, store se nahi.
- **Staff metric:** owner dashboard par "is hafte kitne patients linked hue" per receptionist. Jo cheez napi jati hai wohi hoti hai.
- **R11 scan:** patient ka QR staff app se scan ho kar check-in. Dono spaces ko ek doosre ki zaroorat.
- **Staff jo patient bhi hai:** ek app, space switch (section 3). Clinic ka apna staff pehle patient users banta hai, pilot ke liye free testers.

### Success ki honest definition

| Space | Metric | Target (pilot) |
| --- | --- | --- |
| Patient | Claim rate: visit karne wale patients mein se kitnon ne record link kiya | 25% ya zyada |
| Patient | Dose task completion (confirm ya dismiss) course ke dauran | 50% ya zyada |
| Patient | 60-day keep rate: install ke 60 din baad app maujood (push token zinda ya 1 open) | 50% ya zyada |
| Patient | Appointment confirm rate via app/link; no-show mein kami | 40% confirm; no-show 20% kam |
| Patient | DAU | **Nahi napna.** Ghalat target hai |
| Staff | Working day par active staff / kul mobile-enabled staff | 70% ya zyada |
| Staff | Doctor ke queue actions (call next, complete) mobile se | 30% ya zyada |
| Staff | Sessions per working day per active user | 5 ya zyada |

Staff space hi asal daily-use product hai: doctor din mein 20 se 40 baar queue dekhta hai. Agar staff targets miss hon to patient space se pehle staff space theek karna hai.

## 6. Final feature list

MVP mein 25 features hain, V1 mein 24, V2 mein 10, aur 4 CUT. Effort ek developer + AI ke liye: **S** = 1 hafte tak, **M** = 1 se 2.5 hafte, **L** = 3 hafte ya zyada. Effort mein backend + mobile dono shamil hain.

| ID | Feature | Space | Verdict | Reason | Depends on | Reuses | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F01 | App shell: welcome, `(staff)`/`(patient)` groups, space store, boundary lint | Both | MVP | Har cheez ki bunyad | — | Mobile auth, `Stack.Protected` | M |
| F02 | Staff tabs + lists/filters pattern + 4 states | Staff | MVP | Har staff screen isi par | F01 | `mobile-app/CLAUDE.md` rules | M |
| F03 | Staff realtime (`queue.event`, `notification.new`, `access.changed`) | Staff | MVP | Queue bina realtime ke bekaar | F02 | `queue.gateway.ts` | S |
| F04 | Push: device tables + Expo push `ChannelProvider` | Backend, Both | MVP | "Patient aa gaya", "bari qareeb" | F01 | `notifications` outbox + `ChannelProvider` | M |
| F05 | EAS build, bundle ids, `expo-updates`, min-version endpoint | Both | MVP | Release ke baghair pilot nahi | — | — | S |
| F06 | Offline read cache + idempotent retry | Staff | MVP | Clinic internet kamzor; `Idempotency-Key` retry ko mehfooz banata hai | F02 | Queue idempotency | S |
| F07 | Staff biometric lock | Staff | V1 | Mushtarka phones par PHI | F01 | — | S |
| S01 | Doctor queue: my session, call next, start, complete, skip | Staff | MVP | Staff daily use ka dil | F03 | `doctor-queue.controller.ts` | M |
| S02 | Reception board, walk-in, check-in | Staff | MVP | Reception chalte phirte | F03 | `queue.controller.ts` | M |
| S03 | Patient search, summary, quick register | Staff | MVP | Har flow ka pehla qadam | F02 | `patients` | M |
| S04 | Appointments list (read) | Staff | MVP | Doctor ka "aaj/kal" | F02 | `appointments` | S |
| S05 | Owner "aaj" snapshot | Staff | MVP | Owner ke kholne ki wajah | F02 | Mobile `dashboard` feature | S |
| S06 | Notification bell + push | Staff | MVP | In-app bana hua hai | F04 | `notifications` | S |
| S07 | "Link app" QR + WhatsApp share (web aur staff app) | Staff, Web | MVP | Patient acquisition ka wahid rasta | P02 | `patients` | S |
| S08 | Mobile se nuskha (templates) | Staff | V1 | Bara form; pehle queue sabit ho | S03 | `prescriptions` | L |
| S09 | Appointment book/reschedule | Staff | V1 | Conflict UI mobile par mehnga | S04 | `appointments` validate | M |
| S10 | Payment collect + receipt | Staff | V1 | Reception desktop par hoti hai | S03 | `billing` | M |
| S11 | Vitals entry | Staff | V1 | Nurse ka wahid mobile kaam | S01 | `patients` vitals | S |
| S12 | Clinical photo / document upload | Staff | V1 | Camera mobile ka asal faida | S03 | `patient_documents`, storage | M |
| S13 | Lab order status + result photo | Staff | V1 | Lab-link web pehle se hai | F02 | `lab-*` | S |
| S14 | Approvals: join requests, refunds | Staff | V1 | Owner ke liye | S06 | `clinic-access`, `billing` | S |
| S15 | Patient QR scan se check-in | Staff | V1 | Dono spaces ko jorta hai | P18 | `queue` walk-in/check-in | S |
| S16 | Full offline mode (offline mutations + sync) | Staff | V2 | Queue row lock + transition map offline conflict banate hain; F06 80% faida deta hai | F06 | `QueueOrchestrator` | L |
| S17 | Reports (read-only) | Staff | V2 | Web ka kaam | F02 | `reports` | M |
| S18 | Teeth chart edit phone par | Staff | CUT | Phone screen par ghalat tool; tablet/web | — | — | — |
| P01 | Patient auth: Google/Apple/email code, sessions, guards, fence, tests | Backend, Patient | MVP | Section 3 | F01 | Google ID-token verify, `MailService` | L |
| P02 | Claim/link flow (staff QR, 15 min) | Backend, Patient, Web | MVP | Section 4 | P01 | `patients` | M |
| P03 | Multi-clinic wallet: appointments, visits, nuskhe, bills | Patient | MVP | Aap ka must-have core | P02 | `prescriptions`, `billing`, `encounters` (read) | L |
| P04 | Family profiles (clinic-attested dependents) | Patient | MVP | Aap ka faisla 3; "Aaj" list family se hi qeemti | P02 | `patients` guardian columns | M |
| P05 | "Aaj" list + nuskhe se auto dose reminders (local notifications) | Patient | MVP | Primary hook | P03 | `prescription_medicines.frequency_timing` | M |
| P06 | Live token: visit page (web) + in-app + "bari qareeb" push | Patient, Web | MVP | Install trigger | F04 | `queue` events, ticket | M |
| P07 | Appointment confirm + reschedule/cancel request | Patient | MVP | No-show kam; clinic ke liye seedhi value | P03 | `appointments` | M |
| P08 | Emergency: call / WhatsApp clinic | Patient | MVP | Muft, fori faida | P03 | `locations` phone | S |
| P09 | Account delete, clinic unlink, "kis ne link kiya" | Patient | MVP | Store rule + bharosa | P01 | — | S |
| P10 | Web visit + claim landing pages | Web | MVP | Install se pehle ka darwaza (R20) | P02, P06 | Web `OPEN_PATHS` pattern | S |
| P11 | Manual dawaein + Ramzan mode | Patient | V1 | App ko course ke baad bhi daily rakhta hai | P05 | — | S |
| P12 | Treatment ke baad check-ins + Urdu audio hidayat | Patient, Staff | V1 | Supporting; clinic ko complications pehle pata | P05, B01 | `encounters` | M |
| P13 | Documents / lab reports wallet mein | Patient | V1 | Flag pehle se hai | P03 | `patient_documents.is_visible_to_patient` | S |
| P14 | Braces/aligner routine | Patient | V1 | Sab se lamba, sab se mehnga rishta | P05 | Treatment plans | M |
| P15 | Installment plan + due reminders | Backend, Both | V1 | Entity maujood nahi; clinic recovery | P03 | `billing` statement | L |
| P16 | Appointment request (slot nahi) | Patient, Staff | V1 | Direct booking se behtar | P07 | `appointments` | M |
| P17 | Treatment-plan estimate dekh kar accept | Patient | V1 | Columns pehle se hain | P03 | `patient_accepted`, `patient_consents` | S |
| P18 | Digital clinic card (QR) | Patient | V1 | S15 ka joda | P02 | — | S |
| P19 | "Doctor baithe hain?" + current token | Patient | V1 | Reception ke calls kam | P06 | Queue session state | S |
| P20 | App PIN / biometric | Patient | V1 | Mushtarka phone | P01 | — | S |
| P21 | Visit ke baad feedback | Patient | V1 | Entity maujood | P03 | `patient_feedback` | S |
| P22 | Online payment (JazzCash/Easypaisa/card) | Patient, Backend | V2 | Gateway + merchant onboarding + reconciliation; pehle installment reminders sabit hon | P15 | `billing` payments | L |
| P23 | AI assistant (Urdu mein nuskha/report samjhana) | Patient | V2 | Liability, cost, store review; data pehle | P03, P13 | — | L |
| P24 | Family care plans / packages | Both | V2 | Demand sabit nahi | P04 | `credit_packages`, `patient_credits` | L |
| P25 | Bachon ki brushing routine | Patient | V2 | Novelty jaldi khatam; P14 ka engine use karega | P14 | — | S |
| P26 | Family access grants + 18 saal par transfer | Patient | V2 | MVP mein ek record ek account kaafi | P04 | — | M |
| P27 | Vaccination (EPI) schedule | Patient | V2 | General healthcare ke sath | P04 | — | M |
| P28 | Water/steps/sleep tracker | Patient | CUT | Phone pehle se karta hai; clinic se taluq nahi | — | — | — |
| P29 | Health journal | Patient | CUT | Koi nahi likhta; P12 structured hal hai | — | — | — |
| P30 | Caregiver task assignment | Patient | CUT | WhatsApp group yeh kaam karta hai | — | — | — |
| B01 | Follow-up + recall engine (scheduler, staff call list) | Backend, Staff | V1 | Entity hai, engine nahi; clinic revenue | F04 | `patient_recalls`, `follow_up_date` | M |
| B02 | Patient communication: WhatsApp provider, templates, patient audience on | Backend | V1 | Jo patient app install na kare us tak pohanch | Provider contract | `ChannelProvider`, `patient_comm_prefs` | L |
| B03 | OTP (WhatsApp pehle, SMS fallback) + phone verify | Backend | V1 | Ghar se claim aur phone login kholta hai | B02 | — | M |
| B04 | Clinic patient-app settings + `patient_app` feature key | Backend, Web | MVP | Staged rollout, visibility toggles | — | `feature-flags`, `settings-registry` | S |
| B05 | Pilot analytics (events table + owner counts) | Backend | MVP | Section 9 ke thresholds napne ke liye; third-party SDK health data ke sath nahi | P01 | — | S |
| B06 | Owner report: links per staff | Web, Staff | V1 | Reception ko motivate karta hai | P02 | `reports` | S |
| B07 | Public booking link | Web | V2 | Flag retired; pehle P16 request model sabit ho | P16 | `appointments` | M |
| B08 | Waitlist | Backend, Staff | V2 | Cancellation volume ke baghair faida nahi | P16 | `appointments` | M |

## 7. Channel plan

**Faisla:** MVP kisi paid provider ke baghair launch hota hai. Staff ko Expo push, patient ko local notifications + push, aur patient tak pehli dafa pohanchne ke liye staff ke apne phone se WhatsApp share (wa.me link). WhatsApp Business API V1 mein aati hai, SMS sirf OTP fallback ke taur par.

Neeche ki qeematein yaad-dasht se hain aur **approximate** hain; maine is session mein koi rate card nahi khola. Contract se pehle har ek verify karna hai.

| Channel | Kis kaam ke liye | Cost (approx) | Approval effort | Reliability | Verdict |
| --- | --- | --- | --- | --- | --- |
| Local notification (device par schedule) | Dose reminders, care routine | Free | Koi nahi | Offline chalta hai; Android battery savers (Xiaomi, Oppo, Vivo) kabhi kabhi rok dete hain | **MVP** |
| Push: Expo Push Service se FCM/APNs | Staff alerts, "bari qareeb hai", appointment, follow-up | Free | Apple Developer + Firebase project; `expo-notifications` abhi install nahi (verified) | Internet chahiye; Android OEM kill ka wohi masla | **MVP** |
| Staff WhatsApp share (wa.me / share sheet) | Claim link, nuskha/receipt link, appointment confirm link | Free | Koi nahi | Insani qadam hai: receptionist bhool sakti hai | **MVP** (OTP provider ka fallback bhi) |
| Email (`MailService`, bana hua) | Patient account verify/login code, receipts | SMTP cost | Bana hua | Patients ke paas email kam hoti hai | **MVP**, secondary |
| WhatsApp Business Cloud API | OTP, appointment reminder, follow-up, installment | Per message, category ke hisaab se; utility sasta, authentication darmiyana, marketing mehnga (cents mein) | Meta Business verification (company documents), display name, har template ki approval | Pakistan mein sab se zyada parha jane wala channel | **V1** |
| SMS, local aggregator, masked sender ID | OTP fallback jab WhatsApp na ho | Chand rupay per SMS | PTA/telco masking registration, aam taur par hafton mein | Achi delivery; link par click kam | **V1**, sirf OTP |
| SMS, international gateway (Twilio waghera) | OTP | Local se kai guna mehnga | Asaan signup | Pakistan mein sender ID aur delivery mein masail | **CUT** |

### Provider comparison jo aap ko khud karna hai

| Sawal | Kyun zaroori |
| --- | --- |
| WhatsApp: Meta Cloud API direct ya local BSP (aggregator)? | Direct sasta hai lekin billing/support khud; BSP PKR invoice aur local support deta hai, upar se markup |
| Sender kaun: ek platform number ya har clinic ka apna number? | Recommendation: shuru mein ek platform number, template mein clinic ka naam. Har clinic ka number matlab har clinic ki Meta verification |
| Pakistan ke liye authentication, utility aur marketing template ke current rates | Follow-up/recall "marketing" gina ja sakta hai aur kai guna mehnga hota hai |
| SMS masking: registration time, monthly minimum, per-SMS rate, OTP route ki delivery time | OTP 10 second se zyada late ho to claim flow toot jata hai |
| Cost kaun bharta hai | Recommendation: clinic ko message credits bechein (`subscriptions` module), platform apni jeb se nahi |
| Opt-in ka text aur record | WhatsApp policy opt-in mangti hai; section 4 ki consent table mein store hoga |

### OTP ke baghair claiming (fallback, MVP)

Aaj koi SMS/WhatsApp provider nahi, is liye MVP mein phone OTP nahi hai. Trust "phone ka qabza" se nahi, **clinic ki in-person tasdeeq** se aata hai:

1. Receptionist patient record par "Link app" dabati hai. Backend ek one-time claim token banata hai (15 minute, single use) aur QR dikhata hai.
2. Patient QR scan karta hai, web page ya app khulti hai, woh patient account banata hai: Google sign-in ya email + email code (dono backend mein maujood building blocks se).
3. Link ban jata hai, `verified_by = staff user`, audit ke sath.

Ghar se claim (print par chhapa code) MVP mein **nahi**: us ke liye OTP chahiye. Yeh in-person tareeqa Pakistan mein SMS OTP se zyada mazboot bhi hai, kyun ke ek SIM aksar poori family istemal karti hai. Phone number shakhs ki nahi, ghar ki pehchan hai.

## 8. Backend gap list

Sirf woh jo code mein **nahi** hai (section 1 ke mutabiq verified). Naam tajweez hain; repo ke style par: dotted permission keys, `organization_id`, `ResponseWrapper.success`.

### Naye modules

| Module | Kaam | Phase |
| --- | --- | --- |
| `src/patient-auth/` | Patient login (Google, Apple, email code), `patient_sessions`, `patient-jwt` strategy, `PatientJwtGuard` | MVP |
| `src/patient-app/` | `@PatientApi()`, `PatientFenceGuard`, `PatientLinkGuard`, read-only query services + DTOs (wallet, family, feed, queue, appointments, medications) | MVP |
| `src/patient-links/` | Staff side: claim tokens, link status, revoke | MVP |
| `src/devices/` + `notifications/delivery/expo-push.provider.ts` | `user_devices`, `patient_devices`, Expo push `ChannelProvider` | MVP |
| `src/product-events/` | Pilot analytics events (B05) | MVP |
| `src/follow-ups/` | Scheduler over `patient_recalls` + `follow_up_date`, staff call list | V1 |
| `notifications/delivery/whatsapp.provider.ts`, `sms.provider.ts` | Asal providers `DevLogChannelProvider` ki jagah | V1 |
| `billing/installments/` | Payment plan entity + due schedule | V1 |

### Staff-side endpoints (maujooda guard chain)

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/patients/:patientId/app-link/claim-token` | `patients.app_link.manage` |
| GET | `/patients/:patientId/app-link` | `patients.view` |
| DELETE | `/patients/:patientId/app-link` | `patients.app_link.manage` |
| POST | `/me/devices` | `@AnyMember()` |
| DELETE | `/me/devices/:id` | `@AnyMember()` |
| GET | `/appointments/patient-requests` | `appointments.requests.manage` |
| PATCH | `/appointments/patient-requests/:id` | `appointments.requests.manage` |
| GET | `/app/min-version` | `@Public()` |

Clinic ki patient-app settings ke liye naya endpoint nahi: `settings-registry` ke `patient_app.*` keys maujooda settings API se.

### Patient-side endpoints

`/patient-auth/*` login se pehle ke hain: `@Public()` + rate limit. `/patient-api/*` sab `@PatientApi()` hain; permission column ki jagah "kis link se" hai.

| Method | Path | Access |
| --- | --- | --- |
| POST | `/patient-auth/google`, `/patient-auth/apple` | Public, rate-limited |
| POST | `/patient-auth/email/start`, `/patient-auth/email/verify` | Public, rate-limited |
| POST | `/patient-auth/refresh`, `/patient-auth/logout` | Refresh token |
| GET, DELETE | `/patient-api/me` | Account |
| GET | `/patient-api/claims/:token` | Account; sirf clinic + masked naam |
| POST | `/patient-api/claims/:token/accept` | Account |
| GET, PATCH | `/patient-api/profiles`, `/patient-api/profiles/:id` | Account ke profiles |
| GET, DELETE | `/patient-api/links`, `/patient-api/links/:id` | Account ke links |
| GET | `/patient-api/feed/today` | Tamam active links |
| GET | `/patient-api/appointments` | Active links |
| POST | `/patient-api/appointments/:id/confirm` | Us appointment ka link |
| POST | `/patient-api/appointments/:id/change-request` | Us appointment ka link |
| GET | `/patient-api/prescriptions`, `/patient-api/prescriptions/:id` | Active links; sirf signed |
| GET | `/patient-api/visits` | Active links |
| GET | `/patient-api/billing/summary`, `/patient-api/invoices/:id` | Active links + `patient_app.show_billing` |
| GET | `/patient-api/queue/active` | Active links ki aaj ki entries |
| GET | `/patient-api/medications` | Account ke profiles |
| POST | `/patient-api/medications/dose-events` | Batch; offline sync |
| POST | `/patient-api/devices` | Account |
| GET | `/visit/:token/state` | `@Public()`, rate-limited; sirf token number + position |

### Nayi permission keys (`src/access/catalog/permissions.ts`)

| Key | Feature | Phase |
| --- | --- | --- |
| `patients.app_link.manage` | `patient_app` | MVP |
| `appointments.requests.manage` | `patient_app` | MVP |
| `followups.view`, `followups.manage` | `followups` | V1 |
| `billing.installments.manage` | `billing.installments` | V1 |
| `notifications.patient_messaging.manage` | `patient_messaging` | V1 |

Har edit ke baad `npm run access:export`, aur `access-coverage.spec.ts` naye handlers ko pakrega.

### Naye feature keys

| Key | Kaam | Phase |
| --- | --- | --- |
| `patient_app` | Clinic ke liye patient space on/off; off ho to links read-only | MVP |
| `mobile.staff` | Staff mobile entitlement (plan add-on ke taur par bech sakte hain) | MVP |
| `followups`, `patient_messaging`, `billing.installments` | V1 engines | V1 |

### Naye notification events (`seeds/notification-events.seed.ts`)

| Event | Audience | Channel | Phase |
| --- | --- | --- | --- |
| `queue.turn_near` | patient | push | MVP |
| `queue.called` | patient | push | MVP |
| `appointment.reminder` | patient | push | MVP |
| `prescription.issued` | patient | push (dose schedule sync trigger) | MVP |
| `patient.record_linked` | patient | push + email (security notice) | MVP |
| `appointment.change_requested` | coordinator / staff | in\_app + push | MVP |
| `appointment.change_request_resolved` | patient | push | MVP |
| `followup.due` | coordinator | in\_app + push | V1 |
| `followup.checkin` | patient | push, WhatsApp | V1 |
| `installment.due` | patient | push, WhatsApp | V1 |

Is ke liye teen tabdeeliyan zaroori hain:

- Channel enum mein `push` add karna, aur `CHANNELS_BY_AUDIENCE.patient` mein `push` dalna; jo spec isay khali rakhta hai woh update hoga.
- Patient recipient resolver: `patient_id` se active link, account, devices. Link nahi to `skipped` (V1 mein WhatsApp).
- `appointment.reminder` ko scheduled send chahiye. **Assumption:** `notification_outbox` "is waqt ke baad bhejo" support karta hai; nahi karta to ek `send_after` column + `changes/` script.

### Naye realtime events

| Namespace | Room | Event | Kaam |
| --- | --- | --- | --- |
| `/patient-realtime` (naya) | `entry:<queueEntryId>` | `visit.event` | Position, status, called |
| `/patient-realtime` | `patient:<accountId>` | `feed.changed` | "Aaj" list refresh |
| `/realtime` (maujooda) | `location:<id>:board` | `queue.event` | Mobile sirf consume karega; backend change nahi |

Queue ka outbox relay `visit.event` ko entry rooms tak fan out karega. `QueueOrchestrator` mein koi nayi mutation nahi: patient queue ko sirf dekhta hai.

### Schema additions (section 4 ke ilawa)

| Table / column | Kaam |
| --- | --- |
| `user_devices` | Staff push tokens |
| `queue_visit_tokens` (`entry_id`, `token_hash`, `expires_at`) | Ticket ka QR |
| `appointment_patient_requests` (`organization_id`, `appointment_id`, `kind`, `requested_by_account_id`, `preferred_times` jsonb, `status`, `resolved_by`) | Reschedule/cancel requests |
| `appointments.patient_confirmed_at` | Confirm ka record |
| `product_events` (`actor_type`, `actor_id`, `organization_id`, `name`, `props` jsonb, `at`) | Pilot metrics |

## 9. Minimum viable launch: 90 din, ek clinic

**Pilot Android-only hai.** Pakistan mein bhari aksariyat Android par hai (assumption, measured nahi); iOS chhorne se Apple sign-in, Apple review aur taqreeban 1.5 hafte bachte hain. iOS public launch se pehle aata hai.

**Clinic ka intikhab:** 2 ya zyada doctors, rozana 30 ya zyada patients, web par queue pehle se istemal ho rahi ho, aur owner wada kare ke reception har patient ko QR offer karegi.

### Pilot mein exactly kya hai

| Space | Features |
| --- | --- |
| Foundation | F01, F02, F03, F04, F05, F06, B04, B05 |
| Staff | S01 doctor queue, S02 reception board + walk-in + check-in, S03 patient search/summary, S06 bell + push, S07 "Link app" QR + WhatsApp share |
| Patient | P01 (Google + email code; Apple nahi), P02 claim, P03 wallet (appointments, nuskhe, bills), P04 family, P05 "Aaj" + dose reminders, P06 live token, P07 **sirf confirm**, P08 emergency button, P09 delete/unlink, P10 web pages |

MVP ke yeh hisse pilot ke **dauran** ship hote hain, launch ko nahi rokte: S04 appointments list, S05 owner snapshot, P07 ke reschedule/cancel requests, iOS build.

### Kya napna hai aur pass/fail

| # | Metric | Kaise napa jayega | Pass | Fail |
| --- | --- | --- | --- | --- |
| 1 | Staff daily active | Working day par active staff / mobile-enabled staff (`product_events`) | 70% ya zyada | 40% se kam |
| 2 | Doctor queue actions mobile se | Queue audit events ka client type | 30% ya zyada | 10% se kam |
| 3 | Offer rate | Claim tokens / unique visiting patients | 60% ya zyada | 30% se kam |
| 4 | Claim rate | Active links / unique visiting patients | 25% ya zyada | 10% se kam |
| 5 | Dose response | Taken + skipped / scheduled doses | 50% ya zyada | 20% se kam |
| 6 | 60-day keep | Install ke 60 din baad push token zinda ya 1 open | 50% ya zyada | 25% se kam |
| 7 | Appointment confirm | Confirmed / linked patients ke appointments | 40% ya zyada | 15% se kam |
| 8 | No-show | Linked vs unlinked patients | 20% kam (relative) | Koi farq nahi |
| 9 | Qualitative | 10 patients + 5 staff se guftugu | — | — |

Metric 3 process ko napta hai, product ko nahi: agar offer rate fail ho to claim rate ka number bemaani hai aur masla reception ki training hai. Metric 8 mein self-selection bias hai (jo link karte hain woh waise bhi zyada zimmedar hote hain); isay saboot nahi, ishara samjhein.

**Jo yeh pilot sabit nahi kar sakta:** multi-clinic value. Ek clinic ke sath "ek account, kai clinics" test hi nahi hota. Yeh doosri clinic ke aane tak mafrooza rahega.

### Faisle ka qaida

| Nateeja | Agla qadam |
| --- | --- |
| Staff (1, 2) pass + patient (4, 6) pass | V1 shuru; doosri clinic lao |
| Staff pass, patient fail, offer rate pass | Patient space roko; V1 budget WhatsApp communication (B02) aur follow-up engine (B01) par |
| Staff pass, offer rate fail | Product mat badlo; reception process + B06 report theek karo, 30 din dobara |
| Staff fail | Patient kaam roko; pehle staff space theek karo |

## 10. Phased roadmap

**Ek developer + AI ke sath patient pilot hafta 32 par shuru hota hai; staff space hafta 12 par clinic mein hoti hai.** 16 se 22 hafton ka andaza ek developer ke liye ghalat hai: us mein staff space aur patient auth + claim tak hi kaam hota hai, wallet aur hook nahi. PRD isi 16 se 22 mein do apps, follow-up rule builder, payments aur AI bhi ginti hai, aur khud likhti hai ke yeh team size par depend karta hai.

Staff pehle, is liye ke: (a) woh maujooda APIs par banti hai, naya security model nahi chahiye; (b) asal daily use wahin hai; (c) reception ke haath mein staff app na ho to patient ko QR dikhane wala koi nahi.

| Phase | Hafte | Deliverables | Depends on | Done when |
| --- | --- | --- | --- | --- |
| 0. Foundations | 1 se 2 | F01 app shell + boundary lint; F05 EAS, bundle id, `expo-updates`; staff JWT mein `aud`; `PatientFenceGuard` + route matrix test ka dhancha | App naam + bundle id ka faisla | Android preview build phone par; `(staff)` group mein maujooda login chalta hai; route matrix test CI mein hara |
| 1. Staff space | 3 se 12 | F02, F03, F04 (staff push), F06, S01, S02, S03, S06 | Phase 0 | Doctor poora din sirf mobile se queue chala sake; reception walk-in + check-in kare; "patient aa gaya" push 5 second mein; internet jane par screen cache se khule aur retry duplicate na banaye |
| Gate A | 12 | Staff pilot shuru (wohi clinic) | — | 2 hafte mein metric 1 aur 2 ka pehla number |
| 2. Patient core | 13 se 24 | P01, P02, S07, P10, P03, P04, P09, B04, B05 | Phase 0 fence; privacy policy + terms ka draft | Reception se QR, 2 minute mein record link; do test orgs ke records ek account mein; link isolation aur route matrix tests hare; account delete chalta hai |
| 3. Patient hook | 25 se 30 | P05, P06, P07 (confirm), P08, patient push | Phase 2; F04 | Nuskha sign hote hi phone par dose schedule; airplane mode mein reminder bajta hai; token page QR se 3 second mein; "bari qareeb" push |
| 4. Hardening + release | 31 se 32 | Play Store listing, Data safety form, demo accounts, pilot staff training, OEM battery guide | Google Play account | App Play par (closed ya open track); pilot clinic ke staff ne 10 test claims kiye |
| Gate B | 32 | Patient pilot shuru (90 din) | — | Section 9 ke metrics dashboard par |
| 5. Pilot ke dauran | 33 se 45 | S04, S05, P07 requests, iOS + Apple sign-in, bug fixes; V1 ke contracts (WhatsApp, SMS) | Gate B | Hafta 45 par pass/fail faisla |
| 6. V1a: communication | Pilot pass ke baad, taqreeban 12 | B02, B03, B01, P11, P12 | Provider contracts | Follow-up reminder WhatsApp par jaye; OTP se ghar se claim |
| 7. V1b: baqi V1 | Taqreeban 20 | S08 se S15, F07, P13 se P21, B06 | Pilot ke nateeje se tarteeb | Tarteeb pilot data tay karega |
| 8. V2 | Estimate nahi | Section 6 ke V2 items | Doosri/teesri clinic | — |

### Parallel kya chal sakta hai

Ek developer ke sath asal parallel sirf woh hai jo code nahi:

| Kab | Parallel kaam (paperwork / intezar) |
| --- | --- |
| Phase 0 se | Google Play + Apple developer accounts; pilot clinic se baat |
| Phase 1 ke dauran | Privacy policy, patient terms, clinic terms (section 4.4) ka draft aur lawyer review |
| Phase 2 ke dauran | Meta Business verification + WhatsApp templates; SMS masking registration. Dono mein hafton ka intezar hota hai |
| Phase 3 ke dauran | Store listing, screenshots, reception training material |

Code mein: jab mobile UI ban rahi ho to agle phase ke backend endpoints (section 8 ka contract tay hai) AI session se alag branch par ban sakte hain. Is se 10 se 15% waqt bachta hai, 50% nahi; review phir bhi ek hi insaan karta hai.

### Schedule ke sab se bare khatre

- **P01 + fence + tests (3.5 hafte)** ko chhota mat karein. Yeh woh hissa hai jahan ghalti ka matlab doosri clinic ka data leak hai.
- **P05 ka duration parsing:** `prescription_medicines.duration` free text hai. Agar clinic ke nuskhon mein yeh be-tarteeb nikla to nuskhe ke form mein structured duration add karna parega (web change, +1 hafta).
- **Phase 1 mein "bas ek aur staff screen"** ka lalach. Har V1 staff feature patient pilot ko utna hi peeche dhakelta hai.

## 11. Risks, open questions aur aap ke faisle

### Blockers aur risks

| Risk | Asar | Bachao |
| --- | --- | --- |
| Reception QR offer nahi karti | Patient space ka koi user nahi banta, product kitna bhi acha ho | Metric 3, B06 report, owner ki commitment pilot ki shart |
| Ek developer, 32 hafte | Bimari ya web-app ka urgent kaam poora schedule khiska deta hai | Phase 1 ke baad staff space akeli bhi bechne laiq hai; har phase apni jagah mukammal |
| `@Public()` par patient routes: `EmailVerifiedGuard` / `SubscriptionGuard` ka rawaiya | Patient API 403 de ya, is se bura, bina guard khul jaye | Phase 0 mein test se sabit; `PatientFenceGuard` + coverage spec |
| Android OEM battery savers reminders maar dete hain | Primary hook kamzor | Onboarding mein OEM-specific guide; server push backup; metric 5 se pata chalega |
| Nuskhe ka `duration` free text | Dose schedule ghalat ya khatam hi na ho | Parser + "course kab tak?" patient se confirm; zaroorat par form mein structured field |
| Multi-clinic value pilot mein test nahi hoti | Core idea 45 hafte tak mafrooza | Doosri clinic jald; tab tak isay marketing mein wada na karein |
| Store rejection (dual audience, health data) | 1 se 3 hafte ki takheer | Demo accounts, deletion, declarations pehle din se; pilot closed track par bhi chal sakta hai |
| Maujooda: socket bina token connect hota hai; TV display sirf location UUID se khulta hai | Patient kaam ka blocker nahi, lekin display par jo naam aate hain woh public hain | Display payload review karein (naam ki jagah token number); alag chhota task |

### Pakistan ke privacy/legal points (lawyer se check karwane hain)

Meri maloomat yahan pakki nahi aur waqt ke sath badalti hai; in ko sawal samjhein, jawab nahi.

- **Data protection law:** meri maloomat ke mutabiq Personal Data Protection Bill ke drafts aaye hain lekin jame qanoon nafiz nahi tha. Current haisiyat aur "sensitive/critical personal data" (sehat ka data) par us ki sharten check karein.
- **Data storage ki jagah:** drafts mein kuch data mulk ke andar rakhne ki baat thi. Production database kahan host hogi, yeh faisla is se jura hai.
- **PECA 2016:** data tak ghair-mujaz rasai jurm hai. Staff ka kisi patient ka record apne account se link karna (section 4.8) isi daire mein aa sakta hai; audit trail aap ka difa hai.
- **Medical confidentiality:** PMDC ka code of ethics aur sooba-jati healthcare commissions (PHC, SHCC waghera) ke medical record standards. Patient ko record dikhana aam taur par theek hai; clinic ki ijazat ke baghair doosri clinic ko dikhana nahi (hum nahi dikha rahe).
- **Nabaligh:** guardian ki razamandi ka record (kis ne, kab, kis staff ne tasdeeq ki). 18 saal ki had hi istemal karni hai ya nahi.
- **Consent ki zaban:** terms aur consent Urdu mein bhi.
- **Record retention:** clinic kitne saal record rakhne ki paband hai; 4.4 ki deletion policy is se takrani nahi chahiye.
- **WhatsApp/SMS:** opt-in ka saboot, marketing vs service messages, PTA ke rules.

### Aap se 5 faisle

| # | Faisla | Meri recommendation | Kab tak |
| --- | --- | --- | --- |
| 1 | App ka naam + bundle id / package | Neutral naam (dental-only nahi). Bundle id publish ke baad nahi badalta, is liye pehle | Phase 0 se pehle |
| 2 | Pilot Android-only? | Haan; iOS pilot ke dauran | Phase 0 |
| 3 | Patient login: MVP mein Google + email code, phone OTP V1 mein? | Haan. Phone-first chahiye to pehle SMS/WhatsApp contract, +3 se 4 hafte | Phase 2 se pehle |
| 4 | Clinic chhor jaye to patient ka access (section 4.4) | Read-only jab tak data hai; delete se pehle 30 din notice + PDF | Phase 2 se pehle (terms mein jata hai) |
| 5 | WhatsApp sender aur kharcha: platform number + clinic credits? | Haan | Pilot ke dauran (V1a se pehle) |

In ke baghair bhi main in assumptions par chala hoon: ek developer + AI; pilot clinic dental hai; staff accounts sirf clinic banati hai; patient direct slot book nahi karta; 18 saal nabaligh ki had hai.
