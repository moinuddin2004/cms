import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ClockService } from 'src/common/clock/clock.service';
import { safeTimezone } from 'src/common/clock/tz.util';
import { sqlRows } from 'src/common/database/sql';
import { decide, DecisionReason } from '../decision/notification-decision';
import { NotificationAudienceSetting } from '../entities/notification-audience-setting.entity';
import { NotificationEvent } from '../entities/notification-event.entity';
import {
  NotificationOutbox,
  NotificationPayload,
} from '../entities/notification-outbox.entity';
import { NotificationPlatformOverride } from '../entities/notification-platform-override.entity';
import { NotificationRule } from '../entities/notification-rule.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { PatientCommPref } from '../entities/patient-comm-pref.entity';
import { notificationError } from '../notification-errors';
import { firstNameOf } from '../privacy';
import {
  CHANNELS_BY_AUDIENCE,
  CHANNELS_BY_RECIPIENT,
  defaultAudienceEnabled,
  defaultRuleEnabled,
  emailPrefKey,
  NotificationAudience,
  NotificationChannel,
  NotificationLanguage,
  OutboxStatus,
  RecipientType,
} from '../notifications.enums';
import { pickTemplate, renderTemplate } from '../templates/template-render';

/** Postgres NOTIFY channel; sent in the enqueue transaction, so it fires on commit only. */
export const OUTBOX_NOTIFY_CHANNEL = 'notification_outbox';

export interface NotificationRecipient {
  audience: NotificationAudience;
  type: RecipientType;
  /** users.uuid, patients.id or labs.id. */
  id: string;
  /** Looked up when omitted (users and patients). */
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  language?: NotificationLanguage | null;
}

export interface EnqueueInput {
  organizationId: string;
  /** Quiet hours use this location's timezone unless the setting names one. */
  locationId?: string | null;
  eventCode: string;
  recipients: NotificationRecipient[];
  /** Template placeholders; `clinic_name` and `recipient_name` are added. */
  variables?: Record<string, string | number | null | undefined>;
  /** In-app deep link, e.g. `/lab-orders/<id>`. */
  link?: string | null;
  /** What caused it, for per-entity message logs. */
  entity?: { type: string; id: string } | null;
  /**
   * Do not send before this (e.g. an appointment reminder 24 h ahead). The
   * final `scheduled_for` is the later of this and the quiet-hours decision.
   */
  scheduledFor?: Date;
}

export interface EnqueuedNotification {
  id: string;
  audience: NotificationAudience;
  recipientType: RecipientType;
  recipientId: string;
  channel: NotificationChannel;
  status: OutboxStatus;
  reason: DecisionReason | 'no_address';
  scheduledFor: Date;
}

interface Contact {
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
}

/**
 * The only way to notify anyone (lab ERD §7, §19 "notifications sirf outbox
 * ke zariye"). `enqueue` runs inside the caller's transaction and only
 * writes `notification_outbox` rows — one per recipient × channel, skipped
 * ones included — so a rolled-back change never sends anything and nothing
 * external is called while the transaction is open. The worker
 * (`NotificationDispatcher`) sends committed rows.
 */
@Injectable()
export class NotificationService {
  private readonly events = new Map<string, NotificationEvent>();

  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly clock: ClockService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Fire-and-forget for flows that already committed (no transaction to
   * join): enqueues in its own transaction and never throws, so a
   * notification problem can never undo or fail the business change.
   * Prefer `enqueue(tx, …)` inside the caller's transaction when there is one.
   */
  async notify(
    input: EnqueueInput | (() => Promise<EnqueueInput | null>),
  ): Promise<void> {
    try {
      const resolved = typeof input === 'function' ? await input() : input;
      if (!resolved || !resolved.recipients.length) return;
      await this.dataSource.transaction((m) => this.enqueue(m, resolved));
    } catch (err) {
      const code = typeof input === 'function' ? 'event' : input.eventCode;
      this.logger.error(
        `Notification ${code} not queued: ${(err as Error).message}`,
      );
    }
  }

  /**
   * `enqueue` inside the caller's transaction, behind a savepoint: a failure
   * is logged and rolled back to the savepoint, so it never aborts the
   * caller's transaction (e.g. a patient check-in) — and a rolled-back change
   * still sends nothing.
   */
  async enqueueSafely(m: EntityManager, input: EnqueueInput): Promise<void> {
    if (!input.recipients.length) return;
    await m.query('SAVEPOINT notification_enqueue');
    try {
      await this.enqueue(m, input);
      await m.query('RELEASE SAVEPOINT notification_enqueue');
    } catch (err) {
      await m.query('ROLLBACK TO SAVEPOINT notification_enqueue');
      this.logger.error(
        `Notification ${input.eventCode} not queued: ${(err as Error).message}`,
      );
    }
  }

  /** Clinic-clock date + time for message text, e.g. "5 Nov, 14:30". */
  async clinicTime(at: Date, locationId: string | null): Promise<string> {
    const timeZone = locationId
      ? await this.clock.timezoneFor(locationId)
      : 'UTC';
    return formatClinicTime(at, timeZone);
  }

  async event(m: EntityManager, code: string): Promise<NotificationEvent> {
    let event = this.events.get(code);
    if (!event) {
      event =
        (await m.getRepository(NotificationEvent).findOneBy({ code })) ??
        undefined;
      if (!event) {
        throw notificationError(
          'NOTIFICATION_EVENT_UNKNOWN',
          `Unknown notification event "${code}"`,
        );
      }
      this.events.set(code, event);
    }
    return event;
  }

  async enqueue(
    m: EntityManager,
    input: EnqueueInput,
  ): Promise<EnqueuedNotification[]> {
    const event = await this.event(m, input.eventCode);
    const recipients = dedupe(input.recipients);
    for (const r of recipients) {
      if (!event.audiences.includes(r.audience)) {
        throw notificationError(
          'NOTIFICATION_AUDIENCE_INVALID',
          `${event.code} is not sent to ${r.audience}`,
        );
      }
    }
    if (!recipients.length) return [];

    const org = input.organizationId;
    const [
      settings,
      rules,
      templates,
      contacts,
      prefs,
      clinicName,
      mutedEmail,
      overrides,
    ] = await Promise.all([
      m
        .getRepository(NotificationAudienceSetting)
        .findBy({ organizationId: org }),
      m.getRepository(NotificationRule).findBy({
        organizationId: org,
        eventCode: event.code,
      }),
      m
        .getRepository(NotificationTemplate)
        .createQueryBuilder('t')
        .where('t.event_code = :code', { code: event.code })
        .andWhere('(t.organization_id = :org OR t.organization_id IS NULL)', {
          org,
        })
        .getMany(),
      this.contacts(m, org, recipients),
      this.patientPrefs(m, org, recipients),
      this.clinicName(m, org),
      this.usersWithEmailMuted(m, event.code, recipients),
      m
        .getRepository(NotificationPlatformOverride)
        .findBy({ organizationId: org, eventCode: event.code }),
    ]);
    // Super admin decision for this clinic (mandatory events only): wins over
    // the clinic's own rule and audience switch for that channel.
    const platformMode = new Map(overrides.map((o) => [o.channel, o.mode]));

    const settingOf = new Map(settings.map((s) => [s.audience, s]));
    const ruleOf = new Map(rules.map((r) => [`${r.audience}:${r.channel}`, r]));
    const timezones = new Map<string, string>();
    const timezoneOf = async (s: NotificationAudienceSetting) => {
      if (s.timezone) return safeTimezone(s.timezone);
      if (!input.locationId) return 'UTC';
      if (!timezones.has(input.locationId)) {
        timezones.set(
          input.locationId,
          await this.clock.timezoneFor(input.locationId),
        );
      }
      return timezones.get(input.locationId)!;
    };

    const now = this.clock.now();
    const baseVars = stringify(input.variables ?? {});
    // docs/03 §5: a remote push may carry the patient's first name only, so
    // every event that supplies `patient_name` also gets `patient_first_name`
    // for its push wording — the full name stays in the bell/email text.
    if (baseVars.patient_name && !baseVars.patient_first_name) {
      baseVars.patient_first_name = firstNameOf(baseVars.patient_name);
    }
    // The event's push opt-in is the `push` entry in its code-owned `channels`
    // list (seeded from `EventSeed.pushDefault`, M1-04).
    const pushDefault =
      event.channels?.includes(NotificationChannel.PUSH) === true;
    const rows: Partial<NotificationOutbox>[] = [];
    const results: Omit<EnqueuedNotification, 'id'>[] = [];

    for (const r of recipients) {
      const setting = settingOf.get(r.audience);
      const contact = contacts.get(`${r.type}:${r.id}`) ?? emptyContact();
      const pref =
        r.type === RecipientType.PATIENT ? prefs.get(r.id) : undefined;
      const language =
        r.language ?? pref?.preferredLanguage ?? NotificationLanguage.EN;
      const name = r.name ?? contact.name;
      const variables: Record<string, string> = {
        clinic_name: clinicName,
        ...baseVars,
        recipient_name: name ?? '',
        ...(r.type === RecipientType.PATIENT && !baseVars.patient_name
          ? { patient_name: name ?? '' }
          : {}),
      };
      const quietHours =
        setting?.quietStart && setting.quietEnd
          ? {
              start: setting.quietStart,
              end: setting.quietEnd,
              timezone: await timezoneOf(setting),
            }
          : null;

      for (const channel of channelsFor(r, event)) {
        const rule = ruleOf.get(`${r.audience}:${channel}`);
        const forced = event.isMandatoryInternal
          ? platformMode.get(channel)
          : undefined;
        const decision = decide({
          audience: r.audience,
          channel,
          isMandatoryInternal: event.isMandatoryInternal,
          audienceEnabled:
            forced === 'on' ||
            (setting?.isEnabled ?? defaultAudienceEnabled(r.audience)),
          ruleEnabled: forced
            ? forced === 'on'
            : (rule?.isEnabled ??
              defaultRuleEnabled(
                r.audience,
                channel,
                event.emailDefault,
                pushDefault,
              )),
          // A user's own "no email for this event" (never for mandatory events).
          optedOut:
            isOptedOut(pref, channel) ||
            (channel === NotificationChannel.EMAIL &&
              !event.isMandatoryInternal &&
              r.type === RecipientType.USER &&
              mutedEmail.has(r.id)),
          quietHours,
          now,
        });

        const to = addressFor(channel, r, contact);
        let status = decision.status;
        let reason: EnqueuedNotification['reason'] = decision.reason;
        let lastError: string | null = null;
        const sendable =
          status === OutboxStatus.QUEUED ||
          status === OutboxStatus.HELD_QUIET_HOURS;
        // Push has no address at enqueue time: the devices are resolved when
        // the worker sends, so an empty device list must not fail the row here.
        const needsAddress =
          channel === NotificationChannel.EMAIL ||
          channel === NotificationChannel.SMS ||
          channel === NotificationChannel.WHATSAPP;
        if (sendable && needsAddress && !to) {
          status = OutboxStatus.FAILED;
          reason = 'no_address';
          lastError = `Recipient has no ${channel === NotificationChannel.EMAIL ? 'email address' : 'phone number'}`;
        }

        const template =
          (rule?.templateId &&
            templates.find((t) => t.id === rule.templateId)) ||
          pickTemplate(templates, channel, language);
        const payload: NotificationPayload = {
          title: template?.subject
            ? renderTemplate(template.subject, variables)
            : event.name,
          body: renderTemplate(template?.body ?? event.description, variables),
          link: input.link ?? null,
          language: template?.language ?? language,
          to,
          recipientName: name,
          providerTemplateRef: template?.providerTemplateRef ?? null,
          variables,
          reason,
        };
        const scheduledFor =
          input.scheduledFor && input.scheduledFor > decision.scheduledFor
            ? input.scheduledFor
            : decision.scheduledFor;
        rows.push({
          organizationId: org,
          locationId: input.locationId ?? null,
          eventCode: event.code,
          audience: r.audience,
          recipientType: r.type,
          recipientId: r.id,
          channel,
          entityType: input.entity?.type ?? null,
          entityId: input.entity?.id ?? null,
          payload,
          status,
          scheduledFor,
          attempts: 0,
          lastError,
        });
        results.push({
          audience: r.audience,
          recipientType: r.type,
          recipientId: r.id,
          channel,
          status,
          reason,
          scheduledFor,
        });
      }
    }
    if (!rows.length) return [];

    const inserted = await m
      .createQueryBuilder()
      .insert()
      .into(NotificationOutbox)
      .values(rows)
      .returning(['id'])
      .execute();
    const ids = (inserted.raw as { id: string }[]).map((x) => x.id);

    if (results.some((x) => x.status === OutboxStatus.QUEUED)) {
      await m.query(`SELECT pg_notify($1, '')`, [OUTBOX_NOTIFY_CHANNEL]);
    }
    return results.map((x, i) => ({ id: ids[i], ...x }));
  }

  private async contacts(
    m: EntityManager,
    organizationId: string,
    recipients: NotificationRecipient[],
  ): Promise<Map<string, Contact>> {
    const out = new Map<string, Contact>();
    const ids = (type: RecipientType) =>
      recipients.filter((r) => r.type === type).map((r) => r.id);

    const userIds = ids(RecipientType.USER);
    if (userIds.length) {
      const users = await sqlRows<{
        uuid: string;
        name: string | null;
        email: string | null;
        phone: string | null;
      }>(
        m,
        `SELECT uuid, name, email, phone FROM users WHERE uuid = ANY($1::uuid[])`,
        [userIds],
      );
      for (const u of users) {
        out.set(`${RecipientType.USER}:${u.uuid}`, {
          name: u.name,
          phone: u.phone,
          whatsapp: u.phone,
          email: u.email,
        });
      }
    }

    const patientIds = ids(RecipientType.PATIENT);
    if (patientIds.length) {
      const patients = await sqlRows<{
        id: string;
        full_name: string;
        phone: string | null;
        whatsapp_number: string | null;
        email: string | null;
      }>(
        m,
        `SELECT id, full_name, phone, whatsapp_number, email FROM patients
          WHERE organization_id = $1 AND id = ANY($2::uuid[])`,
        [organizationId, patientIds],
      );
      for (const p of patients) {
        out.set(`${RecipientType.PATIENT}:${p.id}`, {
          name: p.full_name,
          phone: p.phone,
          whatsapp: p.whatsapp_number || p.phone,
          email: p.email,
        });
      }
      // Tenant isolation: never message another clinic's patient.
      const missing = patientIds.find(
        (id) => !out.has(`${RecipientType.PATIENT}:${id}`),
      );
      if (missing) {
        throw notificationError(
          'PATIENT_NOT_FOUND',
          `Patient ${missing} not found`,
        );
      }
    }
    return out;
  }

  private async patientPrefs(
    m: EntityManager,
    organizationId: string,
    recipients: NotificationRecipient[],
  ): Promise<Map<string, PatientCommPref>> {
    const ids = recipients
      .filter((r) => r.type === RecipientType.PATIENT)
      .map((r) => r.id);
    if (!ids.length) return new Map();
    const prefs = await m
      .getRepository(PatientCommPref)
      .createQueryBuilder('p')
      .where('p.organization_id = :organizationId', { organizationId })
      .andWhere('p.patient_id = ANY(:ids)', { ids })
      .getMany();
    return new Map(prefs.map((p) => [p.patientId, p]));
  }

  /** User recipients who switched this event's email off for themselves. */
  private async usersWithEmailMuted(
    m: EntityManager,
    eventCode: string,
    recipients: NotificationRecipient[],
  ): Promise<Set<string>> {
    const ids = recipients
      .filter((r) => r.type === RecipientType.USER)
      .map((r) => r.id);
    if (!ids.length) return new Set();
    const rows = await sqlRows<{ user_id: string }>(
      m,
      `SELECT user_id FROM user_notification_prefs
        WHERE user_id = ANY($1::uuid[]) AND key = $2 AND enabled = false`,
      [ids, emailPrefKey(eventCode)],
    );
    return new Set(rows.map((r) => r.user_id));
  }

  private async clinicName(m: EntityManager, organizationId: string) {
    const [row] = await sqlRows<{ name: string }>(
      m,
      `SELECT name FROM organizations WHERE id = $1`,
      [organizationId],
    );
    return row?.name ?? '';
  }
}

/**
 * Channels considered for a recipient: what its audience uses ∩ what it can
 * receive ∩ what the event allows (e.g. queue check-in is in-app + push).
 * Push is opt-in per event: an event without `push` in its own `channels`
 * list never creates push rows (M1-04).
 */
export function channelsFor(
  r: Pick<NotificationRecipient, 'audience' | 'type'>,
  event?: Pick<NotificationEvent, 'channels'>,
) {
  const reachable = CHANNELS_BY_RECIPIENT[r.type];
  return CHANNELS_BY_AUDIENCE[r.audience].filter(
    (c) =>
      reachable.includes(c) &&
      (c === NotificationChannel.PUSH
        ? !!event?.channels?.includes(NotificationChannel.PUSH)
        : !event?.channels || event.channels.includes(c)),
  );
}

function isOptedOut(
  pref: PatientCommPref | undefined,
  channel: NotificationChannel,
) {
  if (!pref) return false;
  if (channel === NotificationChannel.WHATSAPP) return pref.whatsappOptOut;
  if (channel === NotificationChannel.SMS) return pref.smsOptOut;
  if (channel === NotificationChannel.EMAIL) return pref.emailOptOut;
  return false;
}

function addressFor(
  channel: NotificationChannel,
  r: NotificationRecipient,
  c: Contact,
): string | null {
  switch (channel) {
    case NotificationChannel.WHATSAPP:
      return r.phone ?? c.whatsapp ?? c.phone;
    case NotificationChannel.SMS:
      return r.phone ?? c.phone;
    case NotificationChannel.EMAIL:
      return r.email ?? c.email;
    default:
      return null;
  }
}

/** One row per recipient per channel: the same person listed twice (or under two audiences) gets one. */
function dedupe(recipients: NotificationRecipient[]): NotificationRecipient[] {
  const seen = new Set<string>();
  return recipients.filter((r) => {
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stringify(
  vars: Record<string, string | number | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (v !== null && v !== undefined) out[k] = String(v);
  }
  return out;
}

const emptyContact = (): Contact => ({
  name: null,
  phone: null,
  whatsapp: null,
  email: null,
});

/** "5 Nov 2026, 14:30" on the given clock. */
export const formatClinicTime = (at: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at);
