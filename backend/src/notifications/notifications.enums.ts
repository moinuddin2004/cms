/**
 * Who a notification is for (lab ERD §7). `patient` is the only external
 * audience; the rest are "internal" — the decision order's step 1
 * (`is_mandatory_internal`) applies to them only.
 */
export enum NotificationAudience {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  COORDINATOR = 'coordinator',
  LAB = 'lab',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
  EMAIL = 'email',
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

/** Channels an audience can be reached on — the toggles the settings screen shows. */
export const CHANNELS_BY_AUDIENCE: Record<
  NotificationAudience,
  NotificationChannel[]
> = {
  [NotificationAudience.PATIENT]: [
    NotificationChannel.WHATSAPP,
    NotificationChannel.SMS,
  ],
  [NotificationAudience.DOCTOR]: [
    NotificationChannel.IN_APP,
    NotificationChannel.WHATSAPP,
    NotificationChannel.EMAIL,
  ],
  [NotificationAudience.COORDINATOR]: [
    NotificationChannel.IN_APP,
    NotificationChannel.WHATSAPP,
    NotificationChannel.EMAIL,
  ],
  [NotificationAudience.LAB]: [
    NotificationChannel.IN_APP,
    NotificationChannel.WHATSAPP,
    NotificationChannel.EMAIL,
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
  ],
  [RecipientType.LAB]: [
    NotificationChannel.WHATSAPP,
    NotificationChannel.SMS,
    NotificationChannel.EMAIL,
  ],
};

/**
 * Lazy defaults when a clinic has no row yet (§7 "Patient defaults OFF"):
 * the patient master switch and every patient rule are off; internal
 * audiences are on, with in-app on and the paid/external channels off.
 */
export const defaultAudienceEnabled = (a: NotificationAudience) =>
  isInternalAudience(a);

export const defaultRuleEnabled = (
  a: NotificationAudience,
  c: NotificationChannel,
) => isInternalAudience(a) && c === NotificationChannel.IN_APP;

/** Placeholders every template may use, on top of the event's own. */
export const COMMON_VARIABLES = ['clinic_name', 'recipient_name'] as const;
