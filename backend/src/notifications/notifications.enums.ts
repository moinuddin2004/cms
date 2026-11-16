/**
 * Who a notification is for (lab ERD §7). `patient` is the only external
 * audience; the rest are "internal" — the decision order's step 1
 * (`is_mandatory_internal`) applies to them only. `staff` = the clinic team
 * picked by permission (owners, managers, reception …), not by role name.
 */
export enum NotificationAudience {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  COORDINATOR = 'coordinator',
  LAB = 'lab',
  STAFF = 'staff',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
  EMAIL = 'email',
  /** Expo remote push to the user's registered devices (M1-04). */
  PUSH = 'push',
}

/** Who the outbox row is addressed to: a signed-in user, a patient, or a lab's own contact. */
export enum RecipientType {
  USER = 'user',
  PATIENT = 'patient',
  LAB = 'lab',
}

export enum OutboxStatus {
  QUEUED = 'queued',
  HELD_QUIET_HOURS = 'held_quiet_hours',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  SKIPPED_DISABLED = 'skipped_disabled',
  SKIPPED_OPT_OUT = 'skipped_opt_out',
  /** Email to an address nobody has verified (decided when sending). */
  SKIPPED_UNVERIFIED = 'skipped_unverified',
  /** Push to a user who has no registered device (decided when sending). */
  SKIPPED_NO_DEVICE = 'skipped_no_device',
}

export enum NotificationLanguage {
  EN = 'en',
  UR = 'ur',
  ROMAN_UR = 'roman_ur',
}

export const ALL_AUDIENCES = Object.values(NotificationAudience);
export const ALL_CHANNELS = Object.values(NotificationChannel);
export const ALL_LANGUAGES = Object.values(NotificationLanguage);
export const ALL_OUTBOX_STATUSES = Object.values(OutboxStatus);

/** Statuses the worker still has to act on. */
export const PENDING_STATUSES = [
  OutboxStatus.QUEUED,
  OutboxStatus.HELD_QUIET_HOURS,
] as const;

export const isInternalAudience = (a: NotificationAudience) =>
  a !== NotificationAudience.PATIENT;

/**
 * Channels an audience can be reached on — the toggles the settings screen
 * shows, and the only channels `channelsFor()` ever queues.
 *
 * Clinic-side people get in-app + email (email only to verified addresses,
 * see `AddressVerifier`) + push (staff app devices, M1-04 — only for events
 * whose seed allows `push`, e.g. a patient checking in). WhatsApp / SMS have
 * no provider yet. Patients get PUSH only (M3-07, the patient app) and only
 * for events whose seed lists `push`; no email/SMS/WhatsApp to patients until
 * the patient follow-up project. `notifications.enums.spec.ts` guards it.
 */
export const CHANNELS_BY_AUDIENCE: Record<
  NotificationAudience,
  NotificationChannel[]
> = {
  [NotificationAudience.PATIENT]: [NotificationChannel.PUSH],
  [NotificationAudience.DOCTOR]: [
    NotificationChannel.IN_APP,
    NotificationChannel.EMAIL,
    NotificationChannel.PUSH,
  ],
  [NotificationAudience.COORDINATOR]: [
    NotificationChannel.IN_APP,
    NotificationChannel.EMAIL,
    NotificationChannel.PUSH,
  ],
  [NotificationAudience.LAB]: [
    NotificationChannel.IN_APP,
    NotificationChannel.EMAIL,
  ],
  [NotificationAudience.STAFF]: [
    NotificationChannel.IN_APP,
    NotificationChannel.EMAIL,
    NotificationChannel.PUSH,
  ],
};

/** Channels a recipient kind can physically receive (a patient has no in-app inbox). */
export const CHANNELS_BY_RECIPIENT: Record<
  RecipientType,
  NotificationChannel[]
> = {
  [RecipientType.USER]: ALL_CHANNELS,
  [RecipientType.PATIENT]: [
    NotificationChannel.WHATSAPP,
    NotificationChannel.SMS,
    NotificationChannel.EMAIL,
    NotificationChannel.PUSH,
  ],
  [RecipientType.LAB]: [
    NotificationChannel.WHATSAPP,
    NotificationChannel.SMS,
    NotificationChannel.EMAIL,
  ],
};

/**
 * Lazy defaults when a clinic has no row yet (§7). Patients: the master
 * switch is on (their only channel is the app's push, M3-07) and a patient
 * rule is on only for push events that opt in; every other patient rule is
 * off (no email/WhatsApp/SMS to patients). Internal
 * audiences are on, with in-app on, email on only for events marked
 * `email_default` (the important ones), push only for events marked
 * `push_default` (currently just a patient checking in — M1-04), and
 * WhatsApp / SMS off.
 */
export const defaultAudienceEnabled = (a: NotificationAudience) =>
  isInternalAudience(a) || a === NotificationAudience.PATIENT;

export const defaultRuleEnabled = (
  a: NotificationAudience,
  c: NotificationChannel,
  emailDefault = false,
  pushDefault = false,
) =>
  (isInternalAudience(a) &&
    (c === NotificationChannel.IN_APP ||
      (c === NotificationChannel.EMAIL && emailDefault))) ||
  (c === NotificationChannel.PUSH && pushDefault);

/** Personal switch key in `user_notification_prefs` for one event's email. */
export const emailPrefKey = (eventCode: string) => `email:${eventCode}`;

/** Placeholders every template may use, on top of the event's own. */
export const COMMON_VARIABLES = ['clinic_name', 'recipient_name'] as const;
