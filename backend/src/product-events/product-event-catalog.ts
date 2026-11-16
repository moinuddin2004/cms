/**
 * The ONLY events and props product analytics accepts (M2-13, 03 §10).
 * Anything not listed here is dropped by the server. Never add a free-text,
 * id, name, phone, email or health-related prop: values are enums or a
 * version string. Keep `mobile-app/docs/analytics-events.md` in step.
 */
export type ProductEventActor = 'staff' | 'patient';

export interface ProductEventSpec {
  actor: ProductEventActor;
  /** prop name → the allowed values (enum), or 'version' for a x.y.z string. */
  props: Record<string, readonly string[] | 'version'>;
}

const PLATFORM = ['android', 'ios'] as const;

export const PRODUCT_EVENTS = {
  app_opened: {
    actor: 'staff',
    props: { platform: PLATFORM, appVersion: 'version' },
  },
  staff_signed_in: {
    actor: 'staff',
    props: { method: ['email', 'google', 'password'] },
  },
  staff_checked_in: {
    actor: 'staff',
    props: { source: ['walk_in', 'appointment'] },
  },
  staff_called_next: { actor: 'staff', props: {} },
  patient_app_opened: {
    actor: 'patient',
    props: { platform: PLATFORM, appVersion: 'version' },
  },
  patient_signed_in: {
    actor: 'patient',
    props: { method: ['email', 'google'], isNewAccount: ['true', 'false'] },
  },
  claim_accepted: {
    actor: 'patient',
    props: { relation: ['self', 'child', 'parent', 'spouse', 'other'] },
  },
  records_opened: {
    actor: 'patient',
    props: { kind: ['prescriptions', 'visits', 'invoices', 'appointments'] },
  },
} as const satisfies Record<string, ProductEventSpec>;

export type ProductEventName = keyof typeof PRODUCT_EVENTS;

export const MAX_EVENTS_PER_BATCH = 50;
export const VERSION_RE = /^\d{1,3}(\.\d{1,3}){0,3}$/;
/** Events older than this are stamped "now" (a long-offline phone). */
export const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Retention (days); see mobile-app/docs/analytics-events.md. */
export const PRODUCT_EVENTS_RETENTION_DAYS = 400;
