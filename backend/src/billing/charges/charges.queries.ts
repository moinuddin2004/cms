import { EntityManager, SelectQueryBuilder } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Charge } from '../entities/charge.entity';
import { ChargeResponse } from '../mappers/billing-response.types';
import { toChargeResponse } from '../mappers/charge.mapper';

export type ChargeListState = 'unbilled' | 'open' | 'all';

/** Read side for charges (CQRS-lite): FIFO order, names joined, no N+1. */
export const ChargeQueries = {
  base(
    manager: EntityManager,
    tenant: TenantContext,
  ): SelectQueryBuilder<Charge> {
    return manager
      .getRepository(Charge)
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.doctor', 'd')
      .leftJoinAndSelect('c.invoice', 'inv')
      .where('c.organization_id = :org AND c.location_id = :loc', {
        org: tenant.organizationId,
        loc: tenant.locationId,
      })
      .orderBy('c.charge_date', 'ASC')
      .addOrderBy('c.created_at', 'ASC');
  },

  /**
   * unbilled: ACTIVE, no invoice. open: unbilled + billed on an ISSUED
   * invoice with balance > 0 (what the collect sheet shows). all: everything.
   */
  async forPatient(
    manager: EntityManager,
    tenant: TenantContext,
    patientId: string,
    state: ChargeListState,
  ): Promise<ChargeResponse[]> {
    const qb = ChargeQueries.base(manager, tenant).andWhere(
      'c.patient_id = :patientId',
      { patientId },
    );
    if (state === 'unbilled') {
      qb.andWhere(`c.status = 'ACTIVE' AND c.invoice_id IS NULL`);
    } else if (state === 'open') {
      qb.andWhere(`c.status = 'ACTIVE'`).andWhere(
        `(c.invoice_id IS NULL OR (inv.status = 'ISSUED' AND c.net_amount + c.tax_amount > c.allocated_amount))`,
      );
    }
    return (await qb.getMany()).map(toChargeResponse);
  },

  async byIds(
    manager: EntityManager,
    tenant: TenantContext,
    ids: string[],
  ): Promise<ChargeResponse[]> {
    if (!ids.length) return [];
    const rows = await ChargeQueries.base(manager, tenant)
      .andWhere('c.id IN (:...ids)', { ids })
      .getMany();
    return rows.map(toChargeResponse);
  },
};
