import { EntityManager } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { LocationSettings } from 'src/locations/entities/location-settings.entity';
import { percentToBasisPoints } from '../common/money';

/**
 * The sales-tax rate (%) of the active location (`location_settings.tax_rate`),
 * normalised to 0–100 with 2 decimals. No settings row → 0 (no tax).
 * Read when an invoice is issued (and for the collect preview); the issued
 * invoice keeps its own snapshot afterwards.
 */
export async function locationTaxRate(
  manager: EntityManager,
  tenant: TenantContext,
): Promise<number> {
  const row = await manager.getRepository(LocationSettings).findOne({
    where: { locationId: tenant.locationId },
    select: { id: true, taxRate: true },
  });
  return percentToBasisPoints(row?.taxRate) / 100;
}
