# Notifications + Email — Plan

Status (2026-11-05): **all phases built.** P0 + P1 committed; P2–P5 uncommitted.
Browser-checked on the acceptance harness (schema `acceptit`, SMTP forced to
bad credentials so nothing real is sent).

P3–P5 as built — deviations / decisions:
- Transport: `common/mail/mail-transport.service.ts` (generic SMTP env, Gmail
  fallback), layout `email-layout.ts` (escaped; a button only for http(s)
  links), `email_log` for account emails, `EmailQuota` (`EMAIL_DAILY_CAP`,
  default 450, held mail goes out next day 03:00 UTC). Only 550–554 are
  permanent; any other SMTP error (incl. 535 bad login) is retried.
- `EmailChannelProvider` replaces dev-log for email when SMTP is configured;
  `AddressVerifier` (user / lab verified flag, patients never) checked at
  send time → `skipped_unverified`; dispatcher handles `SkipSendError` /
  `DeferSendError`.
- Events carry `email_default` + `channels` (seed keeps them in step on boot).
  New audience `staff`; recipients by owner / permission
  (`notifications/recipients/staff-recipients.ts`).
- Migration `1793900000000-notification-staff-email-checks` replaces the
  audience / status CHECK constraints (synchronize keeps a same-named CHECK
  whose expression changed) — run `schema:sync:prod` + migrations on deploy.
- Wired events: appointment booked / moved / cancelled (doctor; not when
  the doctor did it), queue check-in (in-app only), inventory low stock +
  expiring (daily digest to owners + `inventory.po.manage`), join request
  created (owners + `employees.manage`) / approved (requester), staff login
  created, clinic approved / rejected (owners), subscription ending soon
  (7/3/1 days) / ended (new daily `subscription-reminders` job), payroll
  generated / paid (employee). Business flows use `enqueueSafely` (savepoint)
  or `notify` (after commit) so a notification problem never fails them.
- Account emails: verify, reset, password reset done, password changed,
  password added, Google linked / unlinked, email changed (to the old
  address), lab address confirmation.
- Lab email: `labs.email_verified_at` + token; confirm link sent when a super
  admin sets / changes it; Lab directory → detail shows status + Resend +
  Mark verified; public page `/lab-email/confirm`; the clinic order page
  disables "Send link" and points to Copy link while unverified.
- Settings: Email column + "Important" badge, "Send test email", "Reset to
  defaults"; `/settings/my-notifications` (sound + per-event email; mandatory
  fixed on).
- Platform override (added after P5): super admin, per clinic, sets each
  mandatory event's email to Clinic decides / Always on / Always off
  (`notification_platform_overrides`; card on Settings → Notifications for
  super admins; `GET/PUT /admin/clinics/:orgId/notification-overrides`).
  An override wins over the owner's rule and audience switch for email and
  locks the switch for the owner (422 `NOTIFICATION_RULE_LOCKED`); audited.
  Without an override the owner can still switch a mandatory email off.
- Not done: portal logins made through `EmployeesService.createPortalUser`
  (employee form with portal access) get no "login created" notice; the
  personal page lists all email events, not only the user's own audience;
  subscription dates use the clinic's main location clock.

P2 as built:
- D3 decided by default: **7-day grace** for accounts that existed before
  enforcement (set lazily on first login / request, link sent then); new
  password accounts (self-signup, staff/owner/super admin created with a
  password, email changed) must verify first (`due = now`).
- `users.email_verification_due_at` + `EmailVerificationService`
  (`user/email-verification.service.ts`) + global `EmailVerifiedGuard`
  (after `JwtAuthGuard`; `/auth/*` open; super admins, Google sessions and
  Google-only accounts exempt; 30 s per-instance cache).
- Super admin: Users → row ⋯ → "Mark email verified" (confirm dialog) →
  `POST /user/:id/verify-email`, security log `EMAIL_VERIFIED_BY_ADMIN`
  (no audit row: `audit_log` needs an organization; users are platform-level).
  Managers: "Resend verification email" → `POST /user/:id/resend-verification`.
- Web: `/confirm-email` screen (continue / resend / sign out); banner shows
  the due date and days left; Users table has an Email column.
- Reset-password fixes done here: case-insensitive lookup, send failure no
  longer leaks account existence, completed reset marks the email verified.
- Found and fixed on the way: `GET/POST/PATCH /user` returned raw `User`
  entities (password hash, token hashes) → `toUserAdminView`; the web app's
  403 code check read `body.code` but the API nests it in `body.error.code`
  (clinic-gate blocks were never picked up either); `setAuth` dropped the
  verification fields, so the banner never showed.
- Moved to P3: lab contact email verification (`labs.email_verified_at`,
  copy-link fallback) and the dispatch-time `AddressVerifier` — both only
  matter once email is actually sent. Resend reports "sent" even when SMTP
  fails (logged only) until P3's `email_log`.

P0/P1 as built — deviations from the text below:
- Realtime does not use a new `LISTEN`: `InAppChannelProvider` writes a row
  into the queue's existing realtime `outbox` (topic `user:<id>`, event
  `notification.new`) in the same transaction as the bell copy, and the
  existing `OutboxRelayService` publishes it (in-process or Redis). Retry =
  no insert = no second toast.
- Chime is synthesised with Web Audio (`lib/notification-sound.ts`), no mp3
  file. Cross-tab "play once" uses the Web Locks API + a last-played id in
  `localStorage`.
- `user_notification_prefs` is keyed `(user_id, key)` — `sound` now,
  `email:<event_code>` later. API: `GET/PUT /me/notifications/prefs`.
- Socket hook lives inside `NotificationBell`, so both the dashboard and the
  lab-portal shells get it.
- P1: the settings UI already hid patients; added the guard spec and the
  message log now leaves out patient rows while patients have no channel.

## Goal

1. Every clinic-side person — owner, doctors, reception/staff, lab users and lab
   contacts — gets notifications **in-app (instantly, no reload)** and **by email**.
2. **Patients get nothing for now.** The system is for clinic users only;
   patient email follow-ups come later (see "Patients later").
3. **No system email ever goes to an unverified address.** Super admin can mark
   any user's email as verified.

## Where we start (facts)

- Engine exists: `backend/src/notifications/` — `enqueue()` in the caller's
  transaction → `notification_outbox` → `NotificationDispatcher` (SKIP LOCKED,
  5 attempts, backoff) → `ChannelProvider` per channel.
- Only `in_app` really sends. `whatsapp` / `sms` / `email` go to
  `DevLogChannelProvider` (console log). `CHANNELS_BY_AUDIENCE` has email
  commented out; patient has `[]`.
- 21 events, all lab-module (order / item / stage / shipment / remake / patient
  receipts). No appointment, queue, inventory, billing v2, staff or auth events.
  Inventory low-stock is a `TODO` (`inventory-alerts.service.ts:61`).
- Bell (`NotificationBell`) polls unread count every 30 s; list loads only when
  the bell opens. No socket, no toast.
- `MailService` (`common/services/mail.service.ts`): nodemailer hardcoded to
  `service: 'gmail'`, sends only verify-email and password-reset, outside the
  outbox (no retry, no log).
- Verification gaps:
  - Self-signup: link sent, but the user is logged in and fully usable; banner only.
  - Owner/admin-created password staff (`user.service.ts` ~L260, ~L370): no
    verification email, `emailVerifiedAt` stays `null` forever.
  - Login / tenant guard never checks verification.
  - **Bug:** `user.dto.ts:21` `emailVerificationPending = !!emailVerificationToken`
    → staff with no token look *verified*.
  - Google users are fine (`email_verified` from Google → `emailVerifiedAt`).
  - Lab contact emails (`RecipientType.LAB`, `labs.email`) have no verification at all.

## Decisions taken (change here if needed)

| # | Decision | Default taken |
|---|---|---|
| D1 | Email provider | **Free SMTP only, no paid API.** Generic SMTP env (`SMTP_HOST/PORT/SECURE/USER/PASS/FROM`) — switching provider = changing env, no code. Start on Gmail app password; Brevo free SMTP as the next step (see "SMTP choice"). No `SMTP_HOST` → dev-log stays. |
| D2 | Unverified password users | **Hard block:** they can sign in, but every tenant request is refused (`EMAIL_NOT_VERIFIED`) until verified. Only verify / resend / logout work. |
| D3 | Existing unverified users at rollout | **Open — see "Open questions".** |
| D4 | Patients | **Not now, but built to be switched on later** (patient email follow-ups are a later project). Patient audience hidden in the UI; `CHANNELS_BY_AUDIENCE.patient` stays `[]`; a spec guards it. Nothing patient-related is deleted — see "Patients later". |
| D5 | Email default | **Decided 2026-11-05:** email is ON by default only for *important* events (`EventSeed.emailDefault: true`); frequent events default to in-app only. **Every** event that allows email shows an email on/off toggle — clinic-wide in Settings → Notifications (owner) and personal in My account → Notifications (each user) — so any event's email can be switched on or off. |
| D6 | Bell polling | 10 minutes as a fallback; the socket gives the instant update. |

---

## Phase 0 — Instant in-app (no reload)

Backend
- `queue.gateway.ts` `handleConnection`: once the JWT is verified, auto-join
  `user:<userId>` (no client `subscribe` needed, nobody else can join it —
  reject `user:*` in `subscribe`).
- `InAppChannelProvider.send()`: when the `INSERT … ON CONFLICT DO NOTHING`
  actually inserted (not a retry), `pg_notify('user_notification', {userId, id,
  title, body, link, eventCode, organizationId})`.
- Gateway (or a small `UserNotificationRelay`) `LISTEN user_notification` →
  `server.to('user:<id>').emit('notification.new', payload)`.
  Postgres NOTIFY instead of direct emit so it works the same in the single
  `all` process and in a future split api/worker (no Redis needed).

Frontend
- `features/notifications/hooks/useNotificationSocket.ts` (pattern of
  `useAccessSocket`): on `notification.new` → invalidate
  `notificationKeys.mine.all` + toast (title, body, "Open" → `link`). Mounted
  once in the dashboard shell and the lab portal shell.
- **Sound on/off:** a short bundled chime (`public/sounds/notification.mp3`,
  no external URL) plays on `notification.new`.
  - Toggle: in the bell popover header (speaker icon, `TooltipButton`
    "Sound on" / "Sound off") and in My account → Notifications (P5).
  - Saved per user on the server (`user_notification_prefs`, key `sound`,
    default **on**) so it follows the user to another PC; mirrored in
    `localStorage` for an instant read on load (wrapped in try/catch).
  - Multiple tabs open → plays once (`BroadcastChannel` leader / "already
    played this id" check).
  - Browsers block audio until the user has clicked the page once; until then
    it stays silent (toast still shows) — no error.
  - Optional later: desktop pop-up (browser `Notification` API, asks
    permission) when the tab is in the background — same toggle row, off by
    default.
- `UNREAD_POLL_MS = 600_000` (10 min); keep `refetchOnWindowFocus`; refetch on
  socket reconnect.
- Toast respects the active org: a notification for another clinic shows
  "(Clinic X)" and the link switches org first — or is badge-only. (Pick
  badge-only + label for v1.)

Tests: provider emits once per outbox row (retry → no second toast); gateway
rejects manual `user:*` subscribe; hook invalidates + toasts.

## Phase 1 — Clinic-only (no patients)

- `NotificationSettingsPage`: hide the patient audience card and patient rows
  in `EventRulesTable`; `PatientMessagesCard` stays hidden (already commented).
- Patient-only events (`tryin.appointment_due`, `appointment.rescheduled_lab_delay`,
  `payment.receipt`, `payment.outstanding_reminder`) hidden from the settings
  list; existing `enqueue` calls keep writing `skipped_disabled` rows (harmless,
  keeps the door open). `item.ready` / `order.completed` keep their staff
  recipients.
- `notifications.enums.spec.ts`: asserts `CHANNELS_BY_AUDIENCE.patient` is empty,
  so nobody "uncomments" it by accident.
- Patient-preference API stays but is unused by the UI.

## Phase 2 — Verified emails only

Source of truth = `users.email_verified_at`.

1. **DTO fix:** `emailVerificationPending = !user.emailVerifiedAt`.
2. **Staff created by owner/admin with a password:** generate the verification
   token and send the verify email (same as self-signup). Google-login staff are
   verified on their first Google sign-in (already happens).
3. **Gate:** in `ClinicGateService` (runs inside `TenantContextGuard`), refuse
   tenant requests from a user with `email_verified_at IS NULL`
   → `403 EMAIL_NOT_VERIFIED`. Super admins exempt. `/auth/*`, `/me`,
   `resend-verification`, `verify-email` stay open.
   Frontend `__root.tsx`: on that code → `/verify-email-required` screen (email
   shown, Resend, "wrong email? contact your clinic owner", logout).
   Gate order: email check runs **before** the clinic-approval check, so a new
   self-signup owner sees "verify your email" first and "approval pending"
   only after — one screen at a time.
   Outbox: add `skipped_unverified` to `OutboxStatus` and to the status check
   list in `entities/sql-list.ts`.
4. **Super admin — mark verified:**
   `POST /admin/users/:id/verify-email` (`@RequireSuperAdmin`) → sets
   `emailVerifiedAt`, clears token, security log `EMAIL_VERIFIED_BY_ADMIN`
   (actor = super admin), audit row. UI: Users page (`/users`) — "Verified /
   Unverified" badge + filter, row action "Mark email verified" through
   `ConfirmDialog`, bulk action for selected rows.
5. **Owner — resend for staff:** Employees row action "Resend verification email"
   (needs the staff-manage permission). Owner can *not* mark verified — only
   super admin.
6. **Email change** (wherever a user's email can be edited): resets
   `emailVerifiedAt` and sends a new link.
7. **Lab contact emails** (`labs.email`, external labs without login):
   new `labs.email_verified_at`; adding a lab or changing its email sends a
   confirm link to that address straight away; super admin (and owner? — open)
   can mark verified. Until then email to that lab is skipped — and because
   `order.magic_link` is how a no-login lab learns about an order, the order
   page shows a warning "Lab email not verified — link not emailed" with a
   **Copy link** button (send it on WhatsApp by hand) and "Resend confirm".
8. **Dispatch-time check** (not only at enqueue): the email provider asks the
   `AddressVerifier` for that recipient type (see "Patients later"); unverified → new outbox status `skipped_unverified`
   (no retry). Shown in the message log.

## Phase 3 — Email channel

- `delivery/email.provider.ts` `EmailChannelProvider` (channels: `[EMAIL]`),
  registered over dev-log when `SMTP_HOST` is set.
- `common/mail/mail-transport.ts`: one nodemailer transport from generic SMTP
  env; `MailService` (auth emails) reuses it — `service: 'gmail'` removed.
- `common/mail/email-layout.ts`: one HTML layout — clinic name, clinic theme
  brand colour (from `theme.*` registry), title, body, CTA button for `link`
  (absolute: `FRONTEND_URL + link`), footer "you get this because you work at
  X — manage in Settings → Notifications"; plus a plain-text part. Neutral
  branding: no product name, no tooth icons.
- Auth emails stay **direct** (must work with no clinic, must be instant) but
  use the same transport + layout and get a row in a small `email_log` (to,
  kind, status, error, at) so failures are visible. Detail in "Auth emails"
  below.
- Enums: add `EMAIL` to doctor / coordinator / lab / staff audiences.
  `defaultRuleEnabled(audience, channel, event)` → in-app on for internal
  audiences; email on only when `event.emailDefault` (D5). Only the *default*
  changes — an owner's saved rule always wins. Template seeds already create
  email templates per channel (insert-if-missing on boot).
- **Default email ON (important)** — `emailDefault: true`:
  all auth/security emails (always sent, no toggle), every
  `isMandatoryInternal` event (order submitted / rejected / clarification /
  expected date changed / remake / correction / shipment lost),
  `order.magic_link`, `join_request.created`, `join_request.approved`,
  `employee.added`, `clinic.approved`, `subscription.trial_ending` /
  `.expired`, `payroll.processed`, `inventory.low_stock` digest.
- **Default email OFF (frequent → in-app only, owner can switch on)**:
  `appointment.booked` / `.rescheduled` / `.cancelled`, `order.accepted`,
  `order.overdue`, `item.ready`, `stage.*` (non-mandatory),
  `shipment.dispatched` / `.received`, `order.completed`.
  `queue.patient_checked_in` is in-app only (no email toggle at all).
- **Daily cap guard** (free SMTP limits): `EMAIL_DAILY_CAP` env (default 450
  for Gmail). A per-day counter in Postgres; at the cap, non-auth emails stay
  `queued` with `scheduled_for` = next day 08:00 clinic time; auth emails are
  never held. Owner sees a notice in the message log when this happens.
- Headers: `List-Unsubscribe` (link to My account → Notifications) for
  deliverability. With Gmail, `SMTP_FROM` must be the same Gmail address
  (display name may differ). `.env.example` updated with all SMTP vars.
- Per-event channel limit: `EventSeed.channels?` — e.g. queue check-in is
  in-app only (an email for "patient waiting" is noise).
- `PermanentSendError` for 5xx "mailbox doesn't exist"; 4xx/timeouts retry.

### Auth emails (part of Phase 3)

Sent by `AuthMailer` (replaces `MailService`), same transport + layout,
logged in `email_log`. These are the only emails allowed to an **unverified**
address — they are how the address gets proven.

| Email | When | Notes |
|---|---|---|
| Verify email | self-signup, staff created with password, email changed, resend | 24 h link (exists) |
| **Forgot password → reset link** | `POST /auth/forgot-password` | exists; 15 min link |
| **Password reset done** | after `resetPassword` succeeds | new — "your password was changed; not you? contact your clinic" |
| **Password changed** | after `changePassword` (signed in) | new — same warning text |
| Google linked / unlinked | Settings → Sign-in methods | new — security notice |
| Email address changed | old address gets a notice, new address gets verify link | new |
| Invite / join approved / welcome | clinic-access + employees | P4 events, but these go direct |

Fixes found in the current reset flow (`auth.service.ts` `forgotPassword`):
- Email lookup is case-sensitive (`findOneBy({ email })`) while Google users are
  stored lowercase → reset silently does nothing for them. Use `LOWER(email)`.
- `sendPasswordReset` is not caught: an SMTP failure returns 500 only for
  emails that exist → leaks which emails have accounts. Catch, log to
  `email_log`, always return the same message.
- Completing a reset proves the mailbox → also set `emailVerifiedAt` if null.
- Super admin reset stays allowed (they sign in with password only).
- Rate limit per email + per IP on forgot-password and resend-verification
  (check the existing auth rate limiter covers both).

### SMTP choice (free)

| Option | Free limit | Good | Watch out |
|---|---|---|---|
| **Gmail / Google Workspace + app password** | ~500/day (Gmail), ~2,000/day (Workspace) | already configured, zero setup | sender is a personal/workspace address; bulk-looking mail can get the account paused; 2-step verification needed for app password |
| **Brevo SMTP relay** | 300/day | own domain as sender, SPF/DKIM, delivery logs | "free" plan adds no branding on SMTP but has the daily cap |
| SMTP2GO | 1,000/month | simple, good dashboard | low monthly cap |
| Mailjet | 200/day (6,000/month) | own domain | low daily cap |

Recommendation: **start with Gmail app password** (works today, enough for a
few clinics); when sending from your own domain or volume grows, move to
**Brevo** by changing env only. Either way: set SPF/DKIM on the sending domain
and keep `SMTP_FROM` a real monitored address. Low-stock and similar bursts go
as a daily digest so free limits hold.

## Phase 4 — Clinic events (who gets what)

New audience `STAFF` ("Clinic team") resolved **by permission**, never by role
name: helper `usersWithPermission(orgId, locationId, perm)` on top of
`AccessResolver` (owner always included where relevant).

| Event | To | Channels |
|---|---|---|
| `appointment.booked` / `.rescheduled` / `.cancelled` | assigned doctor | in-app + email |
| `queue.patient_checked_in` | doctor of that queue | in-app only |
| `inventory.low_stock` / `.out_of_stock` / `.expiring` | users with inventory-manage at the location | in-app + email (daily digest later) |
| `join_request.created` | owner + staff managers | in-app + email |
| `join_request.approved` | the requester | email (+ in-app) |
| `employee.added` (welcome + sign-in link) | the new employee | email |
| `clinic.approved` (super admin approval) | owner | email + in-app |
| `subscription.trial_ending` / `.expired` | owner | email + in-app |
| `payroll.processed` | the employee | in-app + email |
| lab events (existing 21, patient ones excluded) | as today + email | in-app + email |

Billing v2 events (refund approved, invoice voided …) — list to be confirmed.

## Phase 5 — Settings + personal preferences (the toggles)

Two levels of switches; email goes out only when **both** allow it:

1. **Clinic level — Settings → Notifications (owner / `notifications.settings.manage`)**
   - `EventRulesTable`: one row per event, columns **In-app** and **Email**,
     each a `Switch` (wrapped in a `Tooltip`). Default state comes from
     `emailDefault`; an "Important" badge marks default-on events.
   - Group header switches: "Email for all events" on/off per audience
     (doctor / coordinator / lab / staff) — the existing audience master switch
     gets an email sub-switch.
   - "Reset to defaults" button (confirm dialog).
   - Email subject in `TemplateSheet`, "Send test email to me" button, message
     log shows email status incl. `skipped_unverified` and cap-held rows.
2. **Personal level — My account → Notifications (every user)**
   - Same event list, only events this user can receive, with **Email**
     on/off per event (in-app can't be muted, only email).
   - `isMandatoryInternal` events: email switch shown on and disabled, tooltip
     "Required by your clinic".
   - Events the clinic switched off show as disabled, tooltip "Turned off by
     your clinic".
   - **Sound** on/off switch (built in P0) and later the desktop pop-up switch. Table `user_notification_prefs` (user_id, event_code nullable,
  channel nullable, key, enabled) — `event_code` null = a global pref like
  `sound`. The table itself is created in P0 for the sound pref.

## Patients later (keep it extendable)

Patient email follow-ups are a separate later project. Rules now, so turning
them on later is configuration plus a little UI, not a rewrite:

- Keep `NotificationAudience.PATIENT`, `RecipientType.PATIENT`,
  `patient_comm_prefs`, `PatientMessagesCard`, patient templates and the
  existing patient `enqueue` calls. Do not delete them.
- Everything new is channel- and audience-agnostic: `EmailChannelProvider`
  takes any recipient with an address; the layout takes recipient name and a
  footer line; nothing assumes "recipient is a user".
- The verified-only check is an interface (`AddressVerifier` per
  `RecipientType`): users → `users.email_verified_at`, labs →
  `labs.email_verified_at`, patients → returns "not verified" until a patient
  email-confirm flow exists. So a patient email can never slip out early.
- Email footer already has a slot for an unsubscribe link; for patients it will
  carry a signed token → sets `patient_comm_prefs.email_opt_out`.
- To switch on later: add `EMAIL` to `CHANNELS_BY_AUDIENCE.patient`, build the
  patient email-confirm + unsubscribe, un-hide the patient settings card and
  `PatientMessagesCard`, and update the guard spec.

## Order and size

P0 + P1 together (small) → P2 (medium, security-sensitive, do before email
goes live) → P3 (medium) → P4 (medium, one event group at a time) → P5
(small–medium). Email must not be switched on (P3) before P2 is done.
At the end: update CLAUDE.md (notifications are no longer in-app only) and
memory.

## Open questions

1. ~~Email default~~ — decided: important events only, toggle on every event (D5).
2. **Existing unverified users at rollout** (D3): today almost every password
   staff account is unverified, so the hard gate locks them out on deploy.
   Options: (a) super admin bulk-marks them verified before deploy;
   (b) send everyone a verify email and give a 7-day grace with banner, then
   block; (c) block immediately. Recommended: (b).
3. Lab contact email: may the clinic owner mark it verified, or super admin only?
4. Low-stock: instant email per item or one daily digest? (Plan assumes digest.)
