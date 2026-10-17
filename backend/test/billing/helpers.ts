import { randomUUID } from 'crypto';
import { BillingException } from 'src/billing/common/billing-errors';
import { BillingFixture, Clinic } from './billing-it.harness';

export const n = (v: unknown): number => Number(v);

/** `YYYY-MM-DD` of the clinic today ± days (Karachi). */
export function clinicDay(fx: BillingFixture, offset = 0): string {
  const today = fx.clock.today('Asia/Karachi');
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export interface LedgerRow {
  type: string;
  debit: number;
  credit: number;
  description: string;
}

export async function ledger(
  fx: BillingFixture,
  clinic: Clinic,
  patientId: string,
): Promise<LedgerRow[]> {
  const rows: Array<Record<string, string>> = await fx.dataSource.query(
    `SELECT type, debit, credit, description FROM ledger_entries
      WHERE organization_id = $1 AND location_id = $2 AND patient_id = $3
      ORDER BY created_at,
              CASE type WHEN 'INVOICE_ISSUED' THEN 1 WHEN 'INVOICE_ADJUSTED' THEN 2
                        WHEN 'INVOICE_CANCELLED' THEN 3 WHEN 'PAYMENT' THEN 4 ELSE 5 END`,
    [clinic.tenant.organizationId, clinic.tenant.locationId, patientId],
  );
  return rows.map((r) => ({
    type: r.type,
    debit: n(r.debit),
    credit: n(r.credit),
    description: r.description,
  }));
}

export async function ledgerBalance(
  fx: BillingFixture,
  clinic: Clinic,
  patientId: string,
): Promise<number> {
  return (await ledger(fx, clinic, patientId)).reduce(
    (a, r) => a + r.debit - r.credit,
    0,
  );
}

export interface AllocationRow {
  chargeId: string;
  paymentId: string;
  amount: number;
  reason: string;
}

export async function allocations(
  fx: BillingFixture,
  patientId: string,
): Promise<AllocationRow[]> {
  const rows: Array<Record<string, string>> = await fx.dataSource.query(
    `SELECT charge_id, payment_id, amount, reason FROM payment_allocations
      WHERE patient_id = $1 ORDER BY created_at, id`,
    [patientId],
  );
  return rows.map((r) => ({
    chargeId: r.charge_id,
    paymentId: r.payment_id,
    amount: n(r.amount),
    reason: r.reason,
  }));
}

export async function count(
  fx: BillingFixture,
  table:
    | 'payments'
    | 'invoices'
    | 'refunds'
    | 'charges'
    | 'payment_allocations',
  patientId: string,
): Promise<number> {
  const [row] = await fx.dataSource.query(
    `SELECT COUNT(*)::int AS c FROM ${table} WHERE patient_id = $1`,
    [patientId],
  );
  return row.c as number;
}

/** The error code of a rejected billing call (fails the test when it resolves). */
export async function errorCode(call: Promise<unknown>): Promise<string> {
  try {
    await call;
  } catch (err) {
    if (err instanceof BillingException) return err.code;
    throw err;
  }
  throw new Error('Expected a BillingException but the call succeeded');
}

export const uuid = (): string => randomUUID();
