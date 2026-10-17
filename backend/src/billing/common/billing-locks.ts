import { EntityManager, In } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Charge } from '../entities/charge.entity';
import { Invoice } from '../entities/invoice.entity';
import { Payment } from '../entities/payment.entity';
import { billingError, notFound } from './billing-errors';
import { toPaisa } from './money';

/**
 * Row locks for money operations (6.17). Lock order is ALWAYS
 * invoices → charges → payments, each by id, so no two operations can
 * deadlock. Every lock is tenant-scoped.
 */
export const BillingLocks = {
  async invoices(
    manager: EntityManager,
    tenant: TenantContext,
    ids: string[],
  ): Promise<Invoice[]> {
    const list = [...new Set(ids)].sort();
    if (!list.length) return [];
    const rows = await manager
      .getRepository(Invoice)
      .createQueryBuilder('i')
      .setLock('pessimistic_write')
      .where('i.id IN (:...list)', { list })
      .andWhere('i.organization_id = :org AND i.location_id = :loc', {
        org: tenant.organizationId,
        loc: tenant.locationId,
      })
      .orderBy('i.id', 'ASC')
      .getMany();
    if (rows.length !== list.length) throw notFound('Invoice');
    return rows;
  },

  async charges(
    manager: EntityManager,
    tenant: TenantContext,
    ids: string[],
  ): Promise<Charge[]> {
    const list = [...new Set(ids)].sort();
    if (!list.length) return [];
    const rows = await manager
      .getRepository(Charge)
      .createQueryBuilder('c')
      .setLock('pessimistic_write')
      .where('c.id IN (:...list)', { list })
      .andWhere('c.organization_id = :org AND c.location_id = :loc', {
        org: tenant.organizationId,
        loc: tenant.locationId,
      })
      .orderBy('c.id', 'ASC')
      .getMany();
    if (rows.length !== list.length) throw notFound('Charge');
    return rows;
  },

  /**
   * Locks the invoices of the given charges first, then the charges, then
   * re-checks that no charge moved to another invoice in between.
   */
  async chargesWithInvoices(
    manager: EntityManager,
    tenant: TenantContext,
    chargeIds: string[],
  ): Promise<{ charges: Charge[]; invoices: Invoice[] }> {
    const refs = chargeIds.length
      ? await manager.getRepository(Charge).find({
          where: { id: In(chargeIds), organizationId: tenant.organizationId },
          select: { id: true, invoiceId: true },
        })
      : [];
    const invoiceIds = refs
      .map((r) => r.invoiceId)
      .filter((x): x is string => !!x);
    const invoices = await BillingLocks.invoices(manager, tenant, invoiceIds);
    const charges = await BillingLocks.charges(manager, tenant, chargeIds);
    const locked = new Set(invoiceIds);
    if (charges.some((c) => c.invoiceId && !locked.has(c.invoiceId))) {
      throw billingError(
        'BILLING_CHARGE_NOT_OPEN',
        'A charge changed while saving, please retry',
      );
    }
    return { charges, invoices };
  },

  /** The patient's payments that still hold advance, by id. */
  async advancePayments(
    manager: EntityManager,
    tenant: TenantContext,
    patientId: string,
  ): Promise<Payment[]> {
    return manager
      .getRepository(Payment)
      .createQueryBuilder('p')
      .setLock('pessimistic_write')
      .where('p.organization_id = :org AND p.location_id = :loc', {
        org: tenant.organizationId,
        loc: tenant.locationId,
      })
      .andWhere('p.patient_id = :patientId', { patientId })
      .andWhere('p.amount - p.allocated_amount - p.refunded_amount > 0')
      .orderBy('p.id', 'ASC')
      .getMany();
  },

  async payments(
    manager: EntityManager,
    tenant: TenantContext,
    ids: string[],
  ): Promise<Payment[]> {
    const list = [...new Set(ids)].sort();
    if (!list.length) return [];
    const rows = await manager
      .getRepository(Payment)
      .createQueryBuilder('p')
      .setLock('pessimistic_write')
      .where('p.id IN (:...list)', { list })
      .andWhere('p.organization_id = :org AND p.location_id = :loc', {
        org: tenant.organizationId,
        loc: tenant.locationId,
      })
      .orderBy('p.id', 'ASC')
      .getMany();
    if (rows.length !== list.length) throw notFound('Payment');
    return rows;
  },
};

/** Advance (free money) of one payment, in paisa. */
export const paymentAdvancePaisa = (
  p: Pick<Payment, 'amount' | 'allocatedAmount' | 'refundedAmount'>,
): number =>
  toPaisa(p.amount) - toPaisa(p.allocatedAmount) - toPaisa(p.refundedAmount);
