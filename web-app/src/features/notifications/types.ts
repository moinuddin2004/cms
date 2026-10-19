export type NotificationAudience = 'patient' | 'doctor' | 'coordinator' | 'lab'
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
}

export interface NotificationEventSettings {
  code: string
  name: string
  description: string
  audiences: NotificationAudience[]
  isMandatoryInternal: boolean
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

export const AUDIENCE_LABEL: Record<NotificationAudience, string> = {
  patient: 'Patients',
  doctor: 'Doctors',
  coordinator: 'Lab coordinators',
  lab: 'Labs',
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
}

/** Why a message was skipped / held, in the clinic's words. */
export const REASON_LABEL: Partial<Record<string, string>> = {
  mandatory_internal: 'Mandatory notification',
  audience_disabled: 'Switched off for this audience',
  rule_disabled: 'Switched off for this event',
  opted_out: 'Patient opted out',
  quiet_hours: 'Waiting for quiet hours to end',
  enabled: 'Enabled',
  no_address: 'No phone number or email',
}
