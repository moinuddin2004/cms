import { EntityManager } from 'typeorm';
import { LabCreditNote } from '../entities/lab-credit.entity';
import { LabInvoice } from '../entities/lab-invoice.entity';
import { LabPayment } from '../entities/lab-payment.entity';
import { LabPaymentStatus } from '../enums/lab-billing.enums';
import { notFound } from '../common/lab-billing-errors';

/**
 * `SELECT … FOR UPDATE` row locks for money operations (lab ERD §10
 * "Concurrency"). Lock order is ALWAYS invoices → credit notes → payments,
 * each sorted by id, so two operations can never deadlock. Every lock is
 * tenant-scoped.
 */
export const LabBillingLocks = {
  async invoices(
    m: EntityManager,
    organizationId: string,
    ids: string[],
  ): Promise<LabInvoice[]> {
    const list = [...new Set(ids)].sort();
    if (!list.length) return [];
    const rows = await m
      .getRepository(LabInvoice)
      .createQueryBuilder('i')
      .setLock('pessimistic_write')
      .where('i.id IN (:...list)', { list })
      .andWhere('i.organization_id = :org', { org: organizationId })
      .orderBy('i.id', 'ASC')
      .getMany();
    if (rows.length !== list.length) throw notFound('Invoice');
    return rows;
  },

  /** A patient's invoices that still owe money, oldest issue first (FIFO). */
  async openInvoices(
    m: EntityManager,
    organizationId: string,
    patientId: string,
  ): Promise<LabInvoice[]> {
    const rows = await m
      .getRepository(LabInvoice)
      .createQueryBuilder('i')
      .setLock('pessimistic_write')
      .where('i.organization_id = :org AND i.patient_id = :patientId', {
        org: organizationId,
        patientId,
      })
      .andWhere(`i.status IN ('issued', 'partially_paid')`)
      .orderBy('i.id', 'ASC')
      .getMany();
    return rows.sort(
      (a, b) =>
        (a.issuedOn ?? '').localeCompare(b.issuedOn ?? '') ||
        a.id.localeCompare(b.id),
    );
  },

  async creditNote(
    m: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<LabCreditNote> {
    const row = await m
      .getRepository(LabCreditNote)
      .createQueryBuilder('c')
      .setLock('pessimistic_write')
      .where('c.id = :id AND c.organization_id = :org', {
        id,
        org: organizationId,
      })
      .getOne();
    if (!row) throw notFound('Credit note');
    return row;
  },

  async payments(
    m: EntityManager,
    organizationId: string,
    ids: string[],
  ): Promise<LabPayment[]> {
    const list = [...new Set(ids)].sort();
    if (!list.length) return [];
    const rows = await m
      .getRepository(LabPayment)
      .createQueryBuilder('p')
      .setLock('pessimistic_write')
      .where('p.id IN (:...list)', { list })
      .andWhere('p.organization_id = :org', { org: organizationId })
      .orderBy('p.id', 'ASC')
      .getMany();
    if (rows.length !== list.length) throw notFound('Payment');
    return rows;
  },

  /** The patient's posted payments that still hold advance, oldest first. */
  async advancePayments(
    m: EntityManager,
    organizationId: string,
    patientId: string,
  ): Promise<LabPayment[]> {
    const rows = await m
      .getRepository(LabPayment)
      .createQueryBuilder('p')
      .setLock('pessimistic_write')
      .where('p.organization_id = :org AND p.patient_id = :patientId', {
        org: organizationId,
        patientId,
      })
      .andWhere('p.status = :posted', { posted: LabPaymentStatus.POSTED })
      .andWhere('p.amount_paisa - p.allocated_paisa - p.refunded_paisa > 0')
      .orderBy('p.id', 'ASC')
      .getMany();
    return rows.sort(
      (a, b) =>
        a.receivedAt.getTime() - b.receivedAt.getTime() ||
        a.id.localeCompare(b.id),
    );
  },
};

/** Free money (advance) of one payment, in paisa. */
export const advanceOf = (
  p: Pick<
    LabPayment,
    'amountPaisa' | 'allocatedPaisa' | 'refundedPaisa' | 'status'
  >,
): number =>
  p.status === LabPaymentStatus.POSTED
    ? Math.max(0, p.amountPaisa - p.allocatedPaisa - p.refundedPaisa)
    : 0;
