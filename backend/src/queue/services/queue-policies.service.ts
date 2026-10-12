import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { QueuePolicy } from '../entities/queue-policy.entity';
import { RejoinPolicy } from '../enums/queue.enums';
import { ClockService } from 'src/common/clock/clock.service';
import { localDate } from 'src/common/clock/tz.util';
import { UpdateQueuePolicyDto } from '../dto/update-queue-policy.dto';
import { QueueErrors } from '../queue.errors';

export interface EffectivePolicy {
  smartQueueEnabled: boolean;
  earlyWindowMin: number;
  lateGraceMin: number;
  maxLateMin: number;
  walkinStarvationMin: number;
  skippedRejoinPolicy: RejoinPolicy;
  callTimeoutSec: number | null;
  manualSelectReasonRequired: boolean;
  serviceDayCutoff: string;
  /** The location's timezone (not stored on the policy). */
  timezone: string;
  /** Where the values came from. */
  source: 'default' | 'organization' | 'location';
}

/** Defaults from the architecture doc, used until an admin saves settings. */
export const POLICY_DEFAULTS: Omit<EffectivePolicy, 'timezone' | 'source'> = {
  smartQueueEnabled: false,
  earlyWindowMin: 15,
  lateGraceMin: 10,
  maxLateMin: 45,
  walkinStarvationMin: 45,
  skippedRejoinPolicy: RejoinPolicy.END,
  callTimeoutSec: null,
  manualSelectReasonRequired: false,
  serviceDayCutoff: '00:00',
};

const CACHE_MS = 60_000;

/** The policy fields an update may set (scope/version are routing, not data). */
function policyChanges(dto: UpdateQueuePolicyDto): Partial<QueuePolicy> {
  const changes: Partial<QueuePolicy> = {};
  if (dto.smartQueueEnabled !== undefined)
    changes.smartQueueEnabled = dto.smartQueueEnabled;
  if (dto.earlyWindowMin !== undefined)
    changes.earlyWindowMin = dto.earlyWindowMin;
  if (dto.lateGraceMin !== undefined) changes.lateGraceMin = dto.lateGraceMin;
  if (dto.maxLateMin !== undefined) changes.maxLateMin = dto.maxLateMin;
  if (dto.walkinStarvationMin !== undefined)
    changes.walkinStarvationMin = dto.walkinStarvationMin;
  if (dto.skippedRejoinPolicy !== undefined)
    changes.skippedRejoinPolicy = dto.skippedRejoinPolicy;
  if (dto.callTimeoutSec !== undefined)
    changes.callTimeoutSec = dto.callTimeoutSec;
  if (dto.manualSelectReasonRequired !== undefined) {
    changes.manualSelectReasonRequired = dto.manualSelectReasonRequired;
  }
  if (dto.serviceDayCutoff !== undefined)
    changes.serviceDayCutoff = dto.serviceDayCutoff;
  return changes;
}

/**
 * Queue settings: effective policy = location override, else organization
 * default, else built-in defaults. Cached for 60 s per location; writes
 * invalidate the cache.
 */
@Injectable()
export class QueuePoliciesService {
  private readonly cache = new Map<
    string,
    { value: EffectivePolicy; at: number }
  >();

  constructor(
    @InjectRepository(QueuePolicy)
    private readonly policyRepo: Repository<QueuePolicy>,
    private readonly clock: ClockService,
  ) {}

  async getEffective(
    organizationId: string,
    locationId: string,
  ): Promise<EffectivePolicy> {
    const cacheKey = `${organizationId}:${locationId}`;
    const hit = this.cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

    const [locationRow, orgRow] = await Promise.all([
      this.policyRepo.findOne({ where: { organizationId, locationId } }),
      this.policyRepo.findOne({
        where: { organizationId, locationId: IsNull() },
      }),
    ]);
    const row = locationRow ?? orgRow;
    const value: EffectivePolicy = {
      ...(row ? this.pick(row) : POLICY_DEFAULTS),
      timezone: await this.clock.timezoneFor(locationId),
      source: locationRow ? 'location' : orgRow ? 'organization' : 'default',
    };
    this.cache.set(cacheKey, { value, at: Date.now() });
    return value;
  }

  /** Settings screen: org default, this location's override, and what applies. */
  async getForLocation(organizationId: string, locationId: string) {
    const [locationRow, orgRow, effective] = await Promise.all([
      this.policyRepo.findOne({ where: { organizationId, locationId } }),
      this.policyRepo.findOne({
        where: { organizationId, locationId: IsNull() },
      }),
      this.getEffective(organizationId, locationId),
    ]);
    return {
      organizationDefault: orgRow,
      locationOverride: locationRow,
      effective,
    };
  }

  /**
   * Create or update the organization default (`scope: 'organization'`) or
   * this location's override (`scope: 'location'`). `version` is optional
   * optimistic locking for concurrent admins.
   */
  async upsert(
    organizationId: string,
    locationId: string,
    dto: UpdateQueuePolicyDto,
  ): Promise<QueuePolicy> {
    const targetLocationId = dto.scope === 'organization' ? null : locationId;
    let row = await this.policyRepo.findOne({
      where: {
        organizationId,
        locationId: targetLocationId === null ? IsNull() : targetLocationId,
      },
    });

    if (row && dto.version !== undefined && dto.version !== row.version) {
      throw QueueErrors.versionConflict(row);
    }

    if (!row) {
      // A new override starts from what currently applies, so unspecified
      // fields don't silently fall back to the built-in defaults.
      const base =
        targetLocationId === null
          ? POLICY_DEFAULTS
          : this.stripMeta(await this.getEffective(organizationId, locationId));
      row = this.policyRepo.create({
        organizationId,
        locationId: targetLocationId,
        ...base,
      });
    }

    Object.assign(row, policyChanges(dto));
    if (row.maxLateMin < row.lateGraceMin) {
      throw QueueErrors.invalidTransition(
        'max_late_min must be at least late_grace_min',
      );
    }
    row.version = (row.version ?? 0) + 1;
    const saved = await this.policyRepo.save(row);
    this.invalidate(organizationId);
    return saved;
  }

  /** Remove a location override so the organization default applies again. */
  async removeOverride(
    organizationId: string,
    locationId: string,
  ): Promise<void> {
    await this.policyRepo.delete({ organizationId, locationId });
    this.invalidate(organizationId);
  }

  /**
   * Service date for `at`: the location-local date of (local time − cutoff),
   * so a clinic with a 04:00 cutoff keeps 01:30 on the previous service day.
   */
  serviceDate(policy: EffectivePolicy, at: Date): string {
    const [h, m] = policy.serviceDayCutoff.split(':').map(Number);
    const shifted = new Date(
      at.getTime() - ((h || 0) * 60 + (m || 0)) * 60_000,
    );
    return localDate(policy.timezone, shifted);
  }

  private invalidate(organizationId: string) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${organizationId}:`)) this.cache.delete(key);
    }
  }

  private pick(row: QueuePolicy): Omit<EffectivePolicy, 'timezone' | 'source'> {
    return {
      smartQueueEnabled: row.smartQueueEnabled,
      earlyWindowMin: row.earlyWindowMin,
      lateGraceMin: row.lateGraceMin,
      maxLateMin: row.maxLateMin,
      walkinStarvationMin: row.walkinStarvationMin,
      skippedRejoinPolicy: row.skippedRejoinPolicy,
      callTimeoutSec: row.callTimeoutSec,
      manualSelectReasonRequired: row.manualSelectReasonRequired,
      serviceDayCutoff: (row.serviceDayCutoff ?? '00:00').slice(0, 5),
    };
  }

  private stripMeta(
    p: EffectivePolicy,
  ): Omit<EffectivePolicy, 'timezone' | 'source'> {
    return {
      smartQueueEnabled: p.smartQueueEnabled,
      earlyWindowMin: p.earlyWindowMin,
      lateGraceMin: p.lateGraceMin,
      maxLateMin: p.maxLateMin,
      walkinStarvationMin: p.walkinStarvationMin,
      skippedRejoinPolicy: p.skippedRejoinPolicy,
      callTimeoutSec: p.callTimeoutSec,
      manualSelectReasonRequired: p.manualSelectReasonRequired,
      serviceDayCutoff: p.serviceDayCutoff,
    };
  }
}
