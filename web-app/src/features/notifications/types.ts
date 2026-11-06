export type NotificationAudience =
  'patient' | 'doctor' | 'coordinator' | 'lab' | 'staff'
export type NotificationChannel = 'in_app' | 'whatsapp' | 'sms' | 'email'
export type NotificationLanguage = 'en' | 'ur' | 'roman_ur'
export type OutboxStatus =
  | 'queued'
  | 'held_quiet_hours'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'skipped_disabled'
  | 'skipped_opt_out'
  | 'skipped_unverified'

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AudienceSetting {
  audience: NotificationAudience
  isEnabled: boolean
  /** "HH:MM" */
  quietStart: string | null
  quietEnd: string | null
  timezone: string | null
  isDefault: boolean
}

export interface NotificationRule {
  audience: NotificationAudience
  channel: NotificationChannel
  isEnabled: boolean
  isDefault: boolean
  /** Mandatory internal in-app — always on. */
  locked: boolean
  /** Set by the platform (super admin) for this clinic; the clinic can't change it. */
  platformMode?: 'on' | 'off' | null
}

/** Super admin: one mandatory event's email and the platform's decision for a clinic. */
export interface PlatformOverride {
  eventCode: string
  name: string
  description: string
  /** `clinic` = no override, the clinic's own switch decides. */
  mode: 'on' | 'off' | 'clinic'
  updatedAt: string | null
}

export interface NotificationEventSettings {
  code: string
  name: string
  description: string
  audiences: NotificationAudience[]
  isMandatoryInternal: boolean
  /** Email on by default — the important events. */
  emailDefault?: boolean
  variables: string[]
  rules: NotificationRule[]
}

export interface NotificationOverview {
  audiences: AudienceSetting[]
  events: NotificationEventSettings[]
  channelsByAudience: Record<NotificationAudience, NotificationChannel[]>
  languages: NotificationLanguage[]
}

export interface RuleChange {
  eventCode: string
  audience: NotificationAudience
  channel: NotificationChannel
  isEnabled: boolean
}

export interface AudienceSettingInput {
  isEnabled?: boolean
  quietStart?: string | null
  quietEnd?: string | null
  timezone?: string | null
}

export interface NotificationTemplate {
  id: string
  eventCode: string
  channel: NotificationChannel
  language: NotificationLanguage
  subject: string | null
  body: string
  variables: string[]
  providerTemplateRef: string | null
  /** The clinic's own wording (else the platform default). */
  isOverride: boolean
  updatedAt: string
}

export interface TemplateInput {
  eventCode: string
  channel: NotificationChannel
  language: NotificationLanguage
  subject: string | null
  body: string
  providerTemplateRef: string | null
}

export interface OutboxLogEntry {
  id: string
  eventCode: string
  audience: NotificationAudience
  recipientType: 'user' | 'patient' | 'lab'
  recipientId: string
  recipientName: string | null
  to: string | null
  channel: NotificationChannel
  status: OutboxStatus
  reason: string
  title: string | null
  body: string
  entityType: string | null
  entityId: string | null
  scheduledFor: string
  attempts: number
  lastError: string | null
  sentAt: string | null
  createdAt: string
}

export interface OutboxLogParams {
  page: number
  limit: number
  status?: OutboxStatus
  channel?: NotificationChannel
  audience?: NotificationAudience
  search?: string
}

export interface MyNotification {
  id: string
  organizationId: string
  eventCode: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}

/** One event the user may get by email, and their own switch for it. */
export interface MyEmailPref {
  code: string
  name: string
  description: string
  /** Required by the clinic: the switch is fixed on. */
  mandatory: boolean
  /** The clinic emails it by default. */
  clinicDefault: boolean
  enabled: boolean
}

/** The user's own notification switches (`/me/notifications/prefs`). */
export interface MyNotificationPrefs {
  sound: boolean
  email: MyEmailPref[]
}

export interface MyNotificationPrefsInput {
  sound?: boolean
  email?: Record<string, boolean>
}

/** Socket `notification.new` payload — a just-created bell item. */
export interface NotificationNewEvent {
  type: 'notification.new'
  id: string
  organizationId: string
  eventCode: string
  title: string
  body: string
  link: string | null
  createdAt: string
}

export const AUDIENCE_LABEL: Record<NotificationAudience, string> = {
  patient: 'Patients',
  doctor: 'Doctors',
  coordinator: 'Lab coordinators',
  lab: 'Labs',
  staff: 'Clinic team',
}

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  in_app: 'In-app',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
}

export const LANGUAGE_LABEL: Record<NotificationLanguage, string> = {
  en: 'English',
  ur: 'Urdu',
  roman_ur: 'Roman Urdu',
}

export const STATUS_LABEL: Record<OutboxStatus, string> = {
  queued: 'Queued',
  held_quiet_hours: 'Held (quiet hours)',
  sent: 'Sent',
  delivered: 'Delivered',
  failed: 'Failed',
  skipped_disabled: 'Skipped — off',
  skipped_opt_out: 'Skipped — opted out',
  skipped_unverified: 'Skipped — email not verified',
}

/** Why a message was skipped / held, in the clinic's words. */
export const REASON_LABEL: Partial<Record<string, string>> = {
  mandatory_internal: 'Mandatory notification',
  audience_disabled: 'Switched off for this audience',
  rule_disabled: 'Switched off for this event',
  opted_out: 'Opted out',
  quiet_hours: 'Waiting for quiet hours to end',
  enabled: 'Enabled',
  no_address: 'No phone number or email',
}

/** A patient's messaging opt-outs (lab ERD §16 "Patient opt-out"). */
export interface PatientCommPrefs {
  patientId: string
  whatsappOptOut: boolean
  smsOptOut: boolean
  emailOptOut: boolean
  preferredLanguage: string | null
  optedOutAt: string | null
}
