import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { pgError, sqlRows } from 'src/common/database/sql';
import { RegisterDeviceDto } from 'src/devices/dto/device.dto';
import { PatientDevice } from './patient-device.entity';

/**
 * Push targets of the patient space (M3-07). Mirrors `DevicesService`: upsert
 * by token, and a token moves to the calling account.
 *
 * Which patient reaches which phone is decided here and only here:
 * clinic `patients.id` → ACTIVE `patient_record_links` row → profile → account
 * → its devices. A frozen or revoked link, a deleted/disabled account, or a
 * clinic that is not approved never yields a token.
 */
@Injectable()
export class PatientDevicesService {
  private readonly logger = new Logger(PatientDevicesService.name);

  constructor(
    @InjectRepository(PatientDevice)
    private readonly devices: Repository<PatientDevice>,
  ) {}

  /** `POST /patient-api/devices` → `{ id }`. */
  async register(
    accountId: string,
    dto: RegisterDeviceDto,
  ): Promise<{ id: string }> {
    const existing = await this.devices.findOneBy({
      expoPushToken: dto.expoPushToken,
    });
    if (existing) return { id: await this.touch(existing, accountId, dto) };
    try {
      const row = await this.devices.save(
        this.devices.create({
          accountId,
          expoPushToken: dto.expoPushToken,
          platform: dto.platform,
          deviceLabel: dto.deviceLabel ?? null,
          appVersion: dto.appVersion,
          lastSeenAt: new Date(),
        }),
      );
      return { id: row.id };
    } catch (err) {
      if (pgError(err).code !== '23505') throw err;
      const raced = await this.devices.findOneBy({
        expoPushToken: dto.expoPushToken,
      });
      if (!raced) throw err;
      return { id: await this.touch(raced, accountId, dto) };
    }
  }

  /** `DELETE /patient-api/devices` → `{ deleted }`; only the caller's own token. */
  async unregister(
    accountId: string,
    expoPushToken: string,
  ): Promise<{ deleted: boolean }> {
    const result = await this.devices.delete({ accountId, expoPushToken });
    return { deleted: (result.affected ?? 0) > 0 };
  }

  /**
   * Push tokens that should hear about this clinic patient: the accounts of
   * the patient's ACTIVE link (at most one, `uq_patient_record_links_active_patient`).
   */
  async pushTokensForPatient(
    organizationId: string,
    patientId: string,
  ): Promise<string[]> {
    const rows = await sqlRows<{ expo_push_token: string }>(
      this.devices.manager,
      `${TOKENS_FOR_PATIENTS_SQL}
        ORDER BY d.last_seen_at DESC`,
      [organizationId, [patientId]],
    );
    return rows.map((r) => r.expo_push_token);
  }

  /**
   * The subset of `patientIds` that can be reached in the app: an ACTIVE link
   * to a live account — and, unless `requireDevice` is false, at least one
   * registered phone. (A reminder scheduled days ahead passes false: the phone
   * may be registered by the time it is due, and the provider re-checks then.)
   */
  async patientsWithDevices(
    m: EntityManager,
    organizationId: string,
    patientIds: string[],
    requireDevice = true,
  ): Promise<string[]> {
    if (!patientIds.length) return [];
    const rows = await sqlRows<{ patient_id: string }>(
      m,
      `SELECT DISTINCT l.patient_id
         FROM patient_record_links l
         JOIN patient_profiles p ON p.id = l.profile_id AND p.deleted_at IS NULL
         JOIN patient_accounts a ON a.id = p.account_id
                                AND a.status = 'active' AND a.deleted_at IS NULL
         JOIN organizations o ON o.id = l.organization_id
        WHERE l.organization_id = $1 AND l.status = 'active'
          AND l.patient_id = ANY($2::uuid[])
          AND o.approval_status = 'approved' AND o.is_active
          AND ($3::boolean = false
               OR EXISTS (SELECT 1 FROM patient_devices d WHERE d.account_id = a.id))`,
      [organizationId, patientIds, requireDevice],
    );
    return rows.map((r) => r.patient_id);
  }

  /** Drops tokens Expo reported as `DeviceNotRegistered`. */
  async removeTokens(expoPushTokens: string[]): Promise<number> {
    const tokens = [...new Set(expoPushTokens)].filter(Boolean);
    if (!tokens.length) return 0;
    const result = await this.devices.delete({ expoPushToken: In(tokens) });
    const removed = result.affected ?? 0;
    if (removed) {
      this.logger.log(`Removed ${removed} unregistered patient device(s)`);
    }
    return removed;
  }

  private async touch(
    row: PatientDevice,
    accountId: string,
    dto: RegisterDeviceDto,
  ): Promise<string> {
    row.accountId = accountId;
    row.platform = dto.platform;
    row.deviceLabel = dto.deviceLabel ?? null;
    row.appVersion = dto.appVersion;
    row.lastSeenAt = new Date();
    await this.devices.save(row);
    return row.id;
  }
}

const TOKENS_FOR_PATIENTS_SQL = `SELECT d.expo_push_token
         FROM patient_record_links l
         JOIN patient_profiles p ON p.id = l.profile_id AND p.deleted_at IS NULL
         JOIN patient_accounts a ON a.id = p.account_id
                                AND a.status = 'active' AND a.deleted_at IS NULL
         JOIN organizations o ON o.id = l.organization_id
         JOIN patient_devices d ON d.account_id = a.id
        WHERE l.organization_id = $1 AND l.status = 'active'
          AND l.patient_id = ANY($2::uuid[])
          AND o.approval_status = 'approved' AND o.is_active`;
