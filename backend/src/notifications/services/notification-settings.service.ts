import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AuditAction, ActorRef } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { isValidTimezone } from 'src/common/clock/tz.util';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { sqlRows } from 'src/common/database/sql';
import { likePattern } from 'src/labs/common/lab-query';
import { isLockedRule } from '../decision/notification-decision';
import {
  OutboxLogQueryDto,
  RuleChangeDto,
  UpdateAudienceSettingDto,
  UpdatePatientCommPrefsDto,
  UpsertTemplateDto,
} from '../dto/notifications.dto';
import { NotificationAudienceSetting } from '../entities/notification-audience-setting.entity';
import { NotificationEvent } from '../entities/notification-event.entity';
import { NotificationOutbox } from '../entities/notification-outbox.entity';
import { NotificationRule } from '../entities/notification-rule.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { PatientCommPref } from '../entities/patient-comm-pref.entity';
import { notificationError } from '../notification-errors';
import {
  ALL_AUDIENCES,
  ALL_LANGUAGES,
  CHANNELS_BY_AUDIENCE,
  COMMON_VARIABLES,
  defaultAudienceEnabled,
  defaultRuleEnabled,
  NotificationAudience,
  NotificationChannel,
} from '../notifications.enums';
import { placeholdersOf } from '../templates/template-render';

export interface AudienceSettingView {
  audience: NotificationAudience;
  isEnabled: boolean;
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string | null;
  /** No row yet: these are the lazy defaults. */
  isDefault: boolean;
}

export interface RuleView {
  audience: NotificationAudience;
  channel: NotificationChannel;
  isEnabled: boolean;
  isDefault: boolean;
  /** Mandatory internal in-app: always on, cannot be changed. */
  locked: boolean;
}

export interface EventView {
  code: string;
  name: string;
  description: string;
  audiences: NotificationAudience[];
  isMandatoryInternal: boolean;
  variables: string[];
  rules: RuleView[];
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

const audienceSnapshot = (s: NotificationAudienceSetting) => ({
  isEnabled: s.isEnabled,
  quietStart: hhmm(s.quietStart),
  quietEnd: hhmm(s.quietEnd),
  timezone: s.timezone,
});

const templateView = (t: NotificationTemplate) => ({
  id: t.id,
  eventCode: t.eventCode,
  channel: t.channel,
  language: t.language,
  subject: t.subject,
  body: t.body,
  variables: t.variables,
  providerTemplateRef: t.providerTemplateRef,
  isOverride: t.organizationId !== null,
  updatedAt: t.updatedAt,
});

/**
 * Clinic-admin side of notifications (lab ERD §16 settings screen): master
 * switches + quiet hours per audience, event × channel rules, the clinic's
 * own template wording, patient opt-outs and the message log. Every change
 * is audited in the same transaction.
 */
@Injectable()
export class NotificationSettingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async overview(organizationId: string) {
    const m = this.dataSource.manager;
    const [events, settings, rules] = await Promise.all([
      m
        .getRepository(NotificationEvent)
        .find({ order: { sortOrder: 'ASC', code: 'ASC' } }),
      m.getRepository(NotificationAudienceSetting).findBy({ organizationId }),
      m.getRepository(NotificationRule).findBy({ organizationId }),
    ]);
    const settingOf = new Map(settings.map((s) => [s.audience, s]));
    const ruleOf = new Map(
      rules.map((r) => [`${r.eventCode}:${r.audience}:${r.channel}`, r]),
    );

    const audiences: AudienceSettingView[] = ALL_AUDIENCES.map((audience) => {
      const s = settingOf.get(audience);
      return s
        ? { audience, ...audienceSnapshot(s), isDefault: false }
        : {
            audience,
            isEnabled: defaultAudienceEnabled(audience),
            quietStart: null,
            quietEnd: null,
            timezone: null,
            isDefault: true,
          };
    });

    const eventViews: EventView[] = events.map((e) => ({
      code: e.code,
      name: e.name,
      description: e.description,
      audiences: e.audiences,
      isMandatoryInternal: e.isMandatoryInternal,
      variables: [...COMMON_VARIABLES, ...e.variables],
      rules: e.audiences.flatMap((audience) =>
        CHANNELS_BY_AUDIENCE[audience].map((channel) => {
          const locked = isLockedRule(e.isMandatoryInternal, audience, channel);
          const r = ruleOf.get(`${e.code}:${audience}:${channel}`);
          return {
            audience,
            channel,
            isEnabled:
              locked || (r?.isEnabled ?? defaultRuleEnabled(audience, channel)),
            isDefault: !r,
            locked,
          };
        }),
      ),
    }));

    return {
      audiences,
      events: eventViews,
      channelsByAudience: CHANNELS_BY_AUDIENCE,
      languages: ALL_LANGUAGES,
    };
  }

  async updateAudience(
    organizationId: string,
    actor: ActorRef,
    audience: NotificationAudience,
    dto: UpdateAudienceSettingDto,
  ): Promise<AudienceSettingView> {
    if (!ALL_AUDIENCES.includes(audience)) {
      throw notificationError(
        'NOTIFICATION_AUDIENCE_INVALID',
        `Unknown audience ${audience}`,
      );
    }
    const timezone: string | null | undefined = dto.timezone;
    if (timezone && !isValidTimezone(dto.timezone)) {
      throw notificationError(
        'NOTIFICATION_QUIET_HOURS_INVALID',
        `Unknown timezone ${timezone}`,
      );
    }
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(NotificationAudienceSetting);
      let row = await repo.findOne({
        where: { organizationId, audience },
        lock: { mode: 'pessimistic_write' },
      });
      const isNew = !row;
      row ??= repo.create({
        organizationId,
        audience,
        isEnabled: defaultAudienceEnabled(audience),
        quietStart: null,
        quietEnd: null,
        timezone: null,
        createdBy: actor.userId,
      });
      const before = audienceSnapshot(row);
      if (dto.isEnabled !== undefined) row.isEnabled = dto.isEnabled;
      if (dto.quietStart !== undefined) row.quietStart = dto.quietStart;
      if (dto.quietEnd !== undefined) row.quietEnd = dto.quietEnd;
      if (dto.timezone !== undefined) row.timezone = dto.timezone;
      if ((row.quietStart === null) !== (row.quietEnd === null)) {
        throw notificationError(
          'NOTIFICATION_QUIET_HOURS_INVALID',
          'Quiet hours need both a start and an end',
        );
      }
      if (row.quietStart && hhmm(row.quietStart) === hhmm(row.quietEnd)) {
        throw notificationError(
          'NOTIFICATION_QUIET_HOURS_INVALID',
          'Quiet hours start and end must differ',
        );
      }
      row.updatedBy = actor.userId;
      row = await repo.save(row);
      await this.audit.record(m, actor, {
        organizationId,
        entityType: 'notification_audience_setting',
        entityId: row.id,
        action: isNew ? AuditAction.CREATE : AuditAction.UPDATE,
        before: isNew ? null : before,
        after: audienceSnapshot(row),
      });
      return { audience, ...audienceSnapshot(row), isDefault: false };
    });
  }

  /** Upserts rules; unchanged ones are skipped. Returns how many changed. */
  async updateRules(
    organizationId: string,
    actor: ActorRef,
    changes: RuleChangeDto[],
  ): Promise<{ changed: number }> {
    return this.dataSource.transaction(async (m) => {
      const events = await this.eventsByCode(m);
      const repo = m.getRepository(NotificationRule);
      let changed = 0;
      for (const c of changes) {
        const event = events.get(c.eventCode);
        if (!event) {
          throw notificationError(
            'NOTIFICATION_EVENT_UNKNOWN',
            `Unknown event ${c.eventCode}`,
          );
        }
        if (!event.audiences.includes(c.audience)) {
          throw notificationError(
            'NOTIFICATION_AUDIENCE_INVALID',
            `${c.eventCode} is not sent to ${c.audience}`,
          );
        }
        if (!CHANNELS_BY_AUDIENCE[c.audience].includes(c.channel)) {
          throw notificationError(
            'NOTIFICATION_CHANNEL_INVALID',
            `${c.audience} is not reached on ${c.channel}`,
          );
        }
        if (isLockedRule(event.isMandatoryInternal, c.audience, c.channel)) {
          if (!c.isEnabled) {
            throw notificationError(
              'NOTIFICATION_RULE_LOCKED',
              `${event.name} is mandatory in-app for ${c.audience} and cannot be switched off`,
            );
          }
          continue;
        }
        const where = {
          organizationId,
          eventCode: c.eventCode,
          audience: c.audience,
          channel: c.channel,
        };
        let row = await repo.findOne({
          where,
          lock: { mode: 'pessimistic_write' },
        });
        const before =
          row?.isEnabled ?? defaultRuleEnabled(c.audience, c.channel);
        if (row && row.isEnabled === c.isEnabled) continue;
        row ??= repo.create({
          ...where,
          templateId: null,
          createdBy: actor.userId,
        });
        row.isEnabled = c.isEnabled;
        row.updatedBy = actor.userId;
        row = await repo.save(row);
        changed++;
        await this.audit.record(m, actor, {
          organizationId,
          entityType: 'notification_rule',
          entityId: row.id,
          action: AuditAction.UPDATE,
          before: { ...where, isEnabled: before },
          after: { ...where, isEnabled: row.isEnabled },
        });
      }
      return { changed };
    });
  }

  /** Platform defaults and the clinic's overrides (`isOverride`). */
  async templates(organizationId: string, eventCode?: string) {
    const qb = this.dataSource.manager
      .getRepository(NotificationTemplate)
      .createQueryBuilder('t')
      .where('(t.organization_id = :org OR t.organization_id IS NULL)', {
        org: organizationId,
      })
      .orderBy('t.event_code')
      .addOrderBy('t.channel')
      .addOrderBy('t.language');
    if (eventCode) qb.andWhere('t.event_code = :eventCode', { eventCode });
    return (await qb.getMany()).map(templateView);
  }

  async upsertTemplate(
    organizationId: string,
    actor: ActorRef,
    dto: UpsertTemplateDto,
  ) {
    return this.dataSource.transaction(async (m) => {
      const event = (await this.eventsByCode(m)).get(dto.eventCode);
      if (!event) {
        throw notificationError(
          'NOTIFICATION_EVENT_UNKNOWN',
          `Unknown event ${dto.eventCode}`,
        );
      }
      const channels = new Set(
        event.audiences.flatMap((a) => CHANNELS_BY_AUDIENCE[a]),
      );
      if (!channels.has(dto.channel)) {
        throw notificationError(
          'NOTIFICATION_CHANNEL_INVALID',
          `${event.name} is not sent on ${dto.channel}`,
        );
      }
      const allowed = new Set<string>([
        ...COMMON_VARIABLES,
        ...event.variables,
      ]);
      const used = placeholdersOf(dto.subject, dto.body);
      const unknown = used.filter((v) => !allowed.has(v));
      if (unknown.length) {
        throw notificationError(
          'NOTIFICATION_TEMPLATE_INVALID',
          `Unknown placeholder${unknown.length > 1 ? 's' : ''}: ${unknown.map((u) => `{${u}}`).join(', ')}`,
          { unknown, allowed: [...allowed] },
        );
      }

      const repo = m.getRepository(NotificationTemplate);
      const where = {
        organizationId,
        eventCode: dto.eventCode,
        channel: dto.channel,
        language: dto.language,
      };
      let row = await repo.findOne({
        where,
        lock: { mode: 'pessimistic_write' },
      });
      const isNew = !row;
      const before = row
        ? {
            subject: row.subject,
            body: row.body,
            providerTemplateRef: row.providerTemplateRef,
          }
        : null;
      row ??= repo.create({ ...where, createdBy: actor.userId });
      row.subject = dto.subject ?? null;
      row.body = dto.body;
      row.providerTemplateRef = dto.providerTemplateRef ?? null;
      row.variables = used;
      row.updatedBy = actor.userId;
      row = await repo.save(row);
      await this.audit.record(m, actor, {
        organizationId,
        entityType: 'notification_template',
        entityId: row.id,
        action: isNew ? AuditAction.CREATE : AuditAction.UPDATE,
        before,
        after: {
          subject: row.subject,
          body: row.body,
          providerTemplateRef: row.providerTemplateRef,
        },
      });
      return templateView(row);
    });
  }

  /** Drops the clinic's override, so the platform default applies again. */
  async resetTemplate(organizationId: string, actor: ActorRef, id: string) {
    await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(NotificationTemplate);
      const row = await repo.findOneBy({ id, organizationId });
      if (!row) {
        throw notificationError(
          'NOTIFICATION_TEMPLATE_NOT_FOUND',
          'Template not found',
        );
      }
      await m.query(
        `UPDATE notification_rules SET template_id = NULL WHERE template_id = $1`,
        [id],
      );
      await repo.delete({ id, organizationId });
      await this.audit.record(m, actor, {
        organizationId,
        entityType: 'notification_template',
        entityId: id,
        action: AuditAction.VOID,
        before: {
          subject: row.subject,
          body: row.body,
          providerTemplateRef: row.providerTemplateRef,
        },
      });
    });
  }

  /** The message log (§16): what went, when, and why the rest didn't. */
  async log(organizationId: string, q: OutboxLogQueryDto) {
    const qb = this.dataSource.manager
      .getRepository(NotificationOutbox)
      .createQueryBuilder('o')
      .where('o.organization_id = :organizationId', { organizationId })
      .orderBy('o.created_at', 'DESC')
      .addOrderBy('o.id', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    if (q.status) qb.andWhere('o.status = :status', { status: q.status });
    if (q.eventCode)
      qb.andWhere('o.event_code = :eventCode', { eventCode: q.eventCode });
    if (q.channel) qb.andWhere('o.channel = :channel', { channel: q.channel });
    if (q.audience)
      qb.andWhere('o.audience = :audience', { audience: q.audience });
    if (q.search) {
      qb.andWhere(
        `(o.payload->>'recipientName' ILIKE :term OR o.payload->>'to' ILIKE :term
          OR o.payload->>'body' ILIKE :term)`,
        { term: likePattern(q.search) },
      );
    }
    const [rows, total] = await qb.getManyAndCount();
    return PaginatedResponseDto.create(
      rows.map((o) => ({
        id: o.id,
        eventCode: o.eventCode,
        audience: o.audience,
        recipientType: o.recipientType,
        recipientId: o.recipientId,
        recipientName: o.payload.recipientName,
        to: o.payload.to,
        channel: o.channel,
        status: o.status,
        reason: o.payload.reason,
        title: o.payload.title,
        body: o.payload.body,
        entityType: o.entityType,
        entityId: o.entityId,
        scheduledFor: o.scheduledFor,
        attempts: o.attempts,
        lastError: o.lastError,
        sentAt: o.sentAt,
        createdAt: o.createdAt,
      })),
      total,
      q.page,
      q.limit,
    );
  }

  async patientPrefs(organizationId: string, patientId: string) {
    await this.assertPatient(
      this.dataSource.manager,
      organizationId,
      patientId,
    );
    const row = await this.dataSource.manager
      .getRepository(PatientCommPref)
      .findOneBy({ patientId, organizationId });
    return prefsView(patientId, row);
  }

  async updatePatientPrefs(
    organizationId: string,
    actor: ActorRef,
    patientId: string,
    dto: UpdatePatientCommPrefsDto,
  ) {
    return this.dataSource.transaction(async (m) => {
      await this.assertPatient(m, organizationId, patientId);
      const repo = m.getRepository(PatientCommPref);
      let row = await repo.findOne({
        where: { patientId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      const isNew = !row;
      const before = prefsView(patientId, row);
      row ??= repo.create({ patientId, organizationId });
      const turnedOn = (k: 'whatsappOptOut' | 'smsOptOut' | 'emailOptOut') =>
        dto[k] === true && !row![k];
      if (
        turnedOn('whatsappOptOut') ||
        turnedOn('smsOptOut') ||
        turnedOn('emailOptOut')
      ) {
        row.optedOutAt = new Date();
      }
      if (dto.whatsappOptOut !== undefined)
        row.whatsappOptOut = dto.whatsappOptOut;
      if (dto.smsOptOut !== undefined) row.smsOptOut = dto.smsOptOut;
      if (dto.emailOptOut !== undefined) row.emailOptOut = dto.emailOptOut;
      if (dto.preferredLanguage !== undefined)
        row.preferredLanguage = dto.preferredLanguage;
      row.updatedBy = actor.userId;
      row = await repo.save(row);
      const after = prefsView(patientId, row);
      await this.audit.record(m, actor, {
        organizationId,
        entityType: 'patient_comm_prefs',
        entityId: patientId,
        action: isNew ? AuditAction.CREATE : AuditAction.UPDATE,
        before: isNew ? null : { ...before, optedOutAt: null },
        after: { ...after, optedOutAt: null },
      });
      return after;
    });
  }

  private async eventsByCode(m: EntityManager) {
    const events = await m.getRepository(NotificationEvent).find();
    return new Map(events.map((e) => [e.code, e]));
  }

  private async assertPatient(
    m: EntityManager,
    organizationId: string,
    patientId: string,
  ) {
    const [row] = await sqlRows<{ id: string }>(
      m,
      `SELECT id FROM patients WHERE id = $1 AND organization_id = $2`,
      [patientId, organizationId],
    );
    if (!row) throw notificationError('PATIENT_NOT_FOUND', 'Patient not found');
  }
}

function prefsView(patientId: string, row: PatientCommPref | null) {
  return {
    patientId,
    whatsappOptOut: row?.whatsappOptOut ?? false,
    smsOptOut: row?.smsOptOut ?? false,
    emailOptOut: row?.emailOptOut ?? false,
    preferredLanguage: row?.preferredLanguage ?? null,
    optedOutAt: row?.optedOutAt ?? null,
  };
}
