import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { CommissionSettlementStatus } from './commission.enums';
import { CommissionSettlement } from './entities/commission-settlement.entity';

/** Unsettled entries of one assignment, locked so no other settlement takes them. */
export interface LockedEntries {
  ids: string[];
  totalMinor: number;
}

/**
 * Settlement of the commission ledger through payroll. Plain functions over
 * the caller's transaction (payroll has no billing wiring). Entries are
 * locked with SELECT … FOR UPDATE, so one entry can never be in two
 * settlements; their amounts are never changed.
 */
export const CommissionSettlements = {
  /** Every unsettled entry of the assignment created before `before` (UTC). */
  async lockUnsettled(
    manager: EntityManager,
    assignmentId: string,
    before: Date,
  ): Promise<LockedEntries> {
    const rows = await sqlRows<{ id: string; amount_minor: string }>(
      manager,
      `SELECT id, amount_minor FROM commission_entries
        WHERE assignment_id = $1 AND settlement_id IS NULL AND created_at < $2
        ORDER BY id
          FOR UPDATE`,
      [assignmentId, before],
    );
    return {
      ids: rows.map((r) => r.id),
      totalMinor: rows.reduce((a, r) => a + Number(r.amount_minor), 0),
    };
  },

  /** Links the locked entries to a new PENDING settlement of a payroll record. */
  async create(
    manager: EntityManager,
    input: {
      organizationId: string;
      locationId: string;
      assignmentId: string;
      periodStart: string;
      periodEnd: string;
      payrollRecordId: string;
      entries: LockedEntries;
    },
  ): Promise<CommissionSettlement> {
    const repo = manager.getRepository(CommissionSettlement);
    const settlement = await repo.save(
      repo.create({
        organizationId: input.organizationId,
        locationId: input.locationId,
        assignmentId: input.assignmentId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalMinor: input.entries.totalMinor,
        status: CommissionSettlementStatus.PENDING,
        payrollRecordId: input.payrollRecordId,
      }),
    );
    await manager.query(
      `UPDATE commission_entries SET settlement_id = $1
        WHERE id = ANY($2::uuid[]) AND settlement_id IS NULL`,
      [settlement.id, input.entries.ids],
    );
    return settlement;
  },

  /** Payroll mark-paid → its settlement is PAID too (same transaction). */
  async markPaid(
    manager: EntityManager,
    payrollRecordId: string,
    paidAt: Date,
    paidBy: string,
  ): Promise<void> {
    await manager.update(
      CommissionSettlement,
      { payrollRecordId, status: CommissionSettlementStatus.PENDING },
      { status: CommissionSettlementStatus.PAID, paidAt, paidBy },
    );
  },

  /**
   * Payroll record deleted before payment: its entries go back to the
   * unsettled pool and the settlement is removed. Refused once PAID.
   */
  async release(
    manager: EntityManager,
    payrollRecordId: string,
  ): Promise<'none' | 'released' | 'paid'> {
    const s = await manager.getRepository(CommissionSettlement).findOne({
      where: { payrollRecordId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!s) return 'none';
    if (s.status === CommissionSettlementStatus.PAID) return 'paid';
    await manager.query(
      `UPDATE commission_entries SET settlement_id = NULL WHERE settlement_id = $1`,
      [s.id],
    );
    await manager.delete(CommissionSettlement, { id: s.id });
    return 'released';
  },
};

/** Minor → exact "1234.56" for numeric(…,2) columns (no float rounding). */
export function minorToDecimal(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
