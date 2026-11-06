import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import {
  staffRecipient,
  usersWithPermission,
} from 'src/notifications/recipients/staff-recipients';
import { NotificationService } from 'src/notifications/services/notification.service';
import { Cron } from '@nestjs/schedule';
import { InventoryItem } from '../entities/inventory-item.entity';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { InventoryService } from './inventory.service';

@Injectable()
export class InventoryAlertService {
  private readonly logger = new Logger(InventoryAlertService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly inventoryService: InventoryService,
    private readonly notifications: NotificationService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Cron('0 8 * * *') // Every day at 8:00 AM
  async checkAlerts(): Promise<void> {
    // Distinct org/location pairs that have active inventory
    const pairs = await this.itemRepo
      .createQueryBuilder('item')
      .select('item.organizationId', 'organizationId')
      .addSelect('item.locationId', 'locationId')
      .where('item.isActive = :isActive', { isActive: true })
      .groupBy('item.organizationId')
      .addGroupBy('item.locationId')
      .getRawMany<{ organizationId: string; locationId: string }>();

    for (const { organizationId, locationId } of pairs) {
      // Alerts are an add-on of inventory: both features must be on.
      const enabled =
        (await this.featureFlagsService.isFeatureEnabled(
          organizationId,
          'inventory.core',
        )) &&
        (await this.featureFlagsService.isFeatureEnabled(
          organizationId,
          'inventory.alerts',
        ));
      if (!enabled) continue;

      const lowStock = await this.inventoryService.getLowStockItems(
        organizationId,
        locationId,
      );
      const expiring = await this.inventoryService.getExpiringItems(
        organizationId,
        locationId,
      );

      const outOfStock = await this.inventoryService.getOutOfStockItems(
        organizationId,
        locationId,
      );
      const reorder = [...outOfStock, ...lowStock];

      if (reorder.length === 0 && expiring.length === 0) continue;

      this.logger.warn(
        `[Inventory Alerts] org=${organizationId} location=${locationId} ` +
          `lowStock=${lowStock.length} expiringSoon=${expiring.length}`,
      );

      await this.notifyStaff(organizationId, locationId, reorder, expiring);
    }
  }

  /**
   * One daily digest per kind (not one email per item, so free email limits
   * hold) to whoever reorders stock here: owners + `inventory.po.manage`.
   */
  private async notifyStaff(
    organizationId: string,
    locationId: string,
    reorder: InventoryItem[],
    expiring: InventoryItem[],
  ): Promise<void> {
    const m = this.dataSource.manager;
    const userIds = await usersWithPermission(
      m,
      organizationId,
      locationId,
      'inventory.po.manage',
    );
    if (!userIds.length) return;
    const [loc] = await sqlRows<{ name: string }>(
      m,
      `SELECT name FROM locations WHERE id = $1`,
      [locationId],
    );
    const base = {
      organizationId,
      locationId,
      recipients: userIds.map(staffRecipient),
      link: '/inventory',
    };
    if (reorder.length) {
      await this.notifications.notify({
        ...base,
        eventCode: 'inventory.low_stock',
        variables: {
          item_count: reorder.length,
          items: summarize(reorder),
          location_name: loc?.name ?? '',
        },
      });
    }
    if (expiring.length) {
      await this.notifications.notify({
        ...base,
        eventCode: 'inventory.expiring',
        variables: {
          item_count: expiring.length,
          items: summarize(expiring),
          location_name: loc?.name ?? '',
        },
      });
    }
  }
}

/** A bulleted list for the email ("- Gloves" lines), at most `max` items. */
function summarize(items: InventoryItem[], max = 10): string {
  const names = [...new Set(items.map((i) => i.name))];
  const lines = names.slice(0, max).map((n) => `- ${n}`);
  if (names.length > max) lines.push(`- …and ${names.length - max} more`);
  return `\n${lines.join('\n')}`;
}
