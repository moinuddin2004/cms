import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AccessChangeBus } from './access-change-bus';

/**
 * How long a remembered `access_version` is trusted without a bus message.
 * Bounds staleness on an instance that missed a Redis message.
 */
export const ACCESS_VERSION_TTL_MS = 15_000;

/**
 * `organizations.access_version`: +1 on every change to who can do what in
 * an org (employment roles, assignments, feature flags, ownership). Access
 * caches key on it, so a bump invalidates them everywhere at once.
 */
@Injectable()
export class AccessVersionService {
  private readonly logger = new Logger(AccessVersionService.name);
  private readonly versions = new Map<
    string,
    { version: number; at: number }
  >();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bus: AccessChangeBus,
  ) {
    bus.onChange((c) => this.remember(c.organizationId, c.version));
  }

  /** The org's current version (cached for ACCESS_VERSION_TTL_MS). 0 = no such org. */
  async current(organizationId: string): Promise<number> {
    const hit = this.versions.get(organizationId);
    if (hit && Date.now() - hit.at < ACCESS_VERSION_TTL_MS) return hit.version;
    const rows: { access_version: number }[] = await this.dataSource.query(
      'SELECT access_version FROM organizations WHERE id = $1',
      [organizationId],
    );
    if (!rows.length) return 0; // unknown org: not cached (ids come from headers)
    const version = Number(rows[0].access_version);
    this.versions.set(organizationId, { version, at: Date.now() });
    return version;
  }

  /**
   * +1 the org's version and announce it (caches drop, sockets get
   * `access.changed`). Call after the change is committed.
   */
  async bump(organizationId: string): Promise<number | null> {
    const res: unknown = await this.dataSource.query(
      'UPDATE organizations SET access_version = access_version + 1 WHERE id = $1 RETURNING access_version',
      [organizationId],
    );
    // The postgres driver returns [rows, rowCount] for UPDATE ... RETURNING.
    const rows = (
      Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res
    ) as { access_version: number }[];
    if (!rows?.length) return null;
    const version = Number(rows[0].access_version);
    await this.bus.publish({ organizationId, version });
    return version;
  }

  /** Bump without failing the caller (the change itself already committed). */
  async bumpQuietly(organizationId: string): Promise<void> {
    try {
      await this.bump(organizationId);
    } catch (err) {
      this.logger.error(
        `access_version bump failed for org ${organizationId}: ${(err as Error).message}`,
      );
    }
  }

  private remember(organizationId: string, version: number) {
    const known = this.versions.get(organizationId);
    if (!known || known.version <= version) {
      this.versions.set(organizationId, { version, at: Date.now() });
    }
  }
}
