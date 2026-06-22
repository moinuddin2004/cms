import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      const enabled = await this.featureFlagsService.isFeatureEnabled(
        organizationId,
        'inventory.alerts',
      );
      if (!enabled) continue;

      const lowStock = await this.inventoryService.getLowStockItems(
        organizationId,
        locationId,
      );
      const expiring = await this.inventoryService.getExpiringItems(
        organizationId,
        locationId,
      );

      if (lowStock.length === 0 && expiring.length === 0) continue;

      this.logger.warn(
        `[Inventory Alerts] org=${organizationId} location=${locationId} ` +
          `lowStock=${lowStock.length} expiringSoon=${expiring.length}`,
      );

      // TODO: Create in-app notifications when the notification system is built.
      // await this.notificationService.create({ type: 'LOW_STOCK', ... })
    }
  }
}
