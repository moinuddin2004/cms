import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { pgError } from 'src/common/database/sql';
import { RegisterDeviceDto } from './dto/device.dto';
import { UserDevice } from './entities/user-device.entity';

/**
 * Push targets for the staff space (M1-04). Registering the same token twice
 * keeps one row (upsert by token) and moves it to the caller when the phone
 * was previously used by another user — a shared phone must not keep the old
 * user's alerts (07 §4.2).
 */
@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    @InjectRepository(UserDevice)
    private readonly devices: Repository<UserDevice>,
  ) {}

  /** `POST /me/devices` → `{ id }`. */
  async register(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<{ id: string }> {
    const existing = await this.devices.findOneBy({
      expoPushToken: dto.expoPushToken,
    });
    if (existing) return { id: await this.touch(existing, userId, dto) };
    try {
      const row = await this.devices.save(
        this.devices.create({
          userId,
          expoPushToken: dto.expoPushToken,
          platform: dto.platform,
          deviceLabel: dto.deviceLabel ?? null,
          appVersion: dto.appVersion,
          lastSeenAt: new Date(),
        }),
      );
      return { id: row.id };
    } catch (err) {
      // Two registrations of one phone at the same time: the second insert
      // loses to uq_user_devices_token, so fall back to the update path.
      if (pgError(err).code !== '23505') throw err;
      const raced = await this.devices.findOneBy({
        expoPushToken: dto.expoPushToken,
      });
      if (!raced) throw err;
      return { id: await this.touch(raced, userId, dto) };
    }
  }

  /** `DELETE /me/devices` → `{ deleted }`; only the caller's own token. */
  async unregister(
    userId: string,
    expoPushToken: string,
  ): Promise<{ deleted: boolean }> {
    const result = await this.devices.delete({ userId, expoPushToken });
    return { deleted: (result.affected ?? 0) > 0 };
  }

  /** Push tokens of one user, for a send. */
  async pushTokensOf(userId: string): Promise<string[]> {
    const rows = await this.devices.find({
      select: ['expoPushToken'],
      where: { userId },
      order: { lastSeenAt: 'DESC' },
    });
    return rows.map((r) => r.expoPushToken);
  }

  /** Drops tokens Expo reported as `DeviceNotRegistered` (uninstalled app). */
  async removeTokens(expoPushTokens: string[]): Promise<number> {
    const tokens = [...new Set(expoPushTokens)].filter(Boolean);
    if (!tokens.length) return 0;
    const result = await this.devices.delete({ expoPushToken: In(tokens) });
    const removed = result.affected ?? 0;
    if (removed) {
      this.logger.log(`Removed ${removed} unregistered push device(s)`);
    }
    return removed;
  }

  private async touch(
    row: UserDevice,
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<string> {
    row.userId = userId;
    row.platform = dto.platform;
    row.deviceLabel = dto.deviceLabel ?? null;
    row.appVersion = dto.appVersion;
    row.lastSeenAt = new Date();
    await this.devices.save(row);
    return row.id;
  }
}
