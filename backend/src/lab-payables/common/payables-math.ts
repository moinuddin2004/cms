/**
 * Lab payables arithmetic (lab ERD §6b, §15). Pure: no NestJS / TypeORM.
 * All money is integer paisa, rates integer basis points.
 */

import {
  BillLineKind,
  StatementMatch,
  VendorBillStatus,
} from '../enums/payables.enums';

/** round(n × bp / 10000), halves away from zero. */
export function applyBp(paisa: number, bp: number): number {
  const n = BigInt(paisa) * BigInt(bp);
  return Number((2n * n + 10_000n) / 20_000n);
}

export function billTotals(
  lines: ReadonlyArray<{ lineTotalPaisa: number }>,
  taxBp: number,
): { subtotalPaisa: number; taxPaisa: number; totalPaisa: number } {
  const subtotalPaisa = lines.reduce((a, l) => a + l.lineTotalPaisa, 0);
  const taxPaisa = applyBp(subtotalPaisa, taxBp);
  return { subtotalPaisa, taxPaisa, totalPaisa: subtotalPaisa + taxPaisa };
}

/** Status of an approved bill from what has been allocated to it. */
export function settledStatus(
  totalPaisa: number,
  paidPaisa: number,
): VendorBillStatus {
  if (paidPaisa >= totalPaisa) return VendorBillStatus.PAID;
  if (paidPaisa > 0) return VendorBillStatus.PARTIALLY_PAID;
  return VendorBillStatus.APPROVED;
}

// ── draft lines from the order ─────────────────────────────────────────

/** A cost the order says the clinic owes (one item or one approved charge). */
export interface ExpectedCost {
  /** `item:<id>` or `charge:<id>`. */
  key: string;
  kind: BillLineKind;
  orderItemId: string | null;
  chargeRequestId: string | null;
  remakeRequestId: string | null;
  description: string;
  quantity: number;
  unitCostPaisa: number;
  totalPaisa: number;
}

export interface DraftLineRef {
  id: string;
  key: string;
  lineTotalPaisa: number;
}

export interface DraftLinePlan {
  inserts: Array<ExpectedCost & { linePaisa: number }>;
  updates: Array<{
    id: string;
    linePaisa: number;
    quantity: number;
    unitCostPaisa: number;
  }>;
  /** True when something is owed that no open draft holds yet. */
  needsDraft: boolean;
}

/**
 * What the order's open draft must hold so that, per cost, approved bills +
 * draft = what the order says (lab ERD §6c "Vendor bill draft"). A cost that
 * went up after approval (an extra charge approved later) lands on a new
 * draft as the difference. A zero cost (a lab-fault remake, §15) is listed
 * on an open draft for the record but never opens a draft of its own; a cost
 * that went down after approval is left to a manual credit.
 */
export function planDraftLines(
  expected: readonly ExpectedCost[],
  billedApproved: ReadonlyMap<string, number>,
  draftLines: readonly DraftLineRef[],
  hasDraft: boolean,
): DraftLinePlan {
  const byKey = new Map(draftLines.map((l) => [l.key, l]));
  const plan: DraftLinePlan = { inserts: [], updates: [], needsDraft: false };
  for (const e of expected) {
    const already = billedApproved.get(e.key) ?? 0;
    const want = e.totalPaisa - already;
    const existing = byKey.get(e.key);
    const isDelta = already > 0;
    const quantity = isDelta ? 1 : e.quantity;
    const unitCostPaisa = isDelta ? Math.max(want, 0) : e.unitCostPaisa;
    if (existing) {
      if (want >= 0 && existing.lineTotalPaisa !== want) {
        plan.updates.push({
          id: existing.id,
          linePaisa: want,
          quantity,
          unitCostPaisa,
        });
      }
      continue;
    }
    if (want < 0) continue;
    if (want === 0 && (already > 0 || !hasDraft)) continue;
    plan.inserts.push({
      ...e,
      description: isDelta ? `${e.description} (additional)` : e.description,
      quantity,
      unitCostPaisa,
      linePaisa: want,
    });
    if (want > 0) plan.needsDraft = true;
  }
  return plan;
}

// ── statement reconciliation ───────────────────────────────────────────

export interface SystemBill {
  billId: string;
  billNo: string;
  vendorInvoiceNo: string | null;
  orderNo: string | null;
  totalPaisa: number;
  firstLineId: string | null;
}

export interface StatementLineIn {
  labReference: string | null;
  amountPaisa: number;
}

export interface LineMatch {
  matchStatus: StatementMatch;
  systemAmountPaisa: number | null;
  matchedBillId: string | null;
  matchedBillLineId: string | null;
}

export interface Reconciliation {
  lines: LineMatch[];
  /** Bills of the period the statement left out. */
  missingInStatement: SystemBill[];
  /** Bills a statement line matched (by amount). */
  matchedBillIds: string[];
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toUpperCase();

/**
 * Matches statement lines to the period's bills by reference (the lab's
 * invoice no, our bill no, or the order no — an order's bills count
 * together) and amount (lab ERD §6c "Statement matching"). Each bill is
 * used once; whatever no line claimed comes back as `missingInStatement`.
 */
export function reconcile(
  statement: readonly StatementLineIn[],
  bills: readonly SystemBill[],
): Reconciliation {
  const byBill = new Map<string, SystemBill[]>();
  const byOrder = new Map<string, SystemBill[]>();
  for (const b of bills) {
    for (const k of [b.vendorInvoiceNo, b.billNo]) {
      if (norm(k)) byBill.set(norm(k), [b]);
    }
    if (norm(b.orderNo)) {
      const list = byOrder.get(norm(b.orderNo)) ?? [];
      list.push(b);
      byOrder.set(norm(b.orderNo), list);
    }
  }
  const used = new Set<string>();
  const matched = new Set<string>();
  const lines = statement.map((s): LineMatch => {
    const ref = norm(s.labReference);
    const group = (byBill.get(ref) ?? byOrder.get(ref) ?? []).filter(
      (b) => !used.has(b.billId),
    );
    if (!ref || !group.length) {
      return {
        matchStatus: StatementMatch.MISSING_IN_SYSTEM,
        systemAmountPaisa: null,
        matchedBillId: null,
        matchedBillLineId: null,
      };
    }
    group.forEach((b) => used.add(b.billId));
    const system = group.reduce((a, b) => a + b.totalPaisa, 0);
    const ok = system === s.amountPaisa;
    if (ok) group.forEach((b) => matched.add(b.billId));
    return {
      matchStatus: ok ? StatementMatch.MATCHED : StatementMatch.AMOUNT_MISMATCH,
      systemAmountPaisa: system,
      matchedBillId: group[0].billId,
      matchedBillLineId: group[0].firstLineId,
    };
  });
  return {
    lines,
    missingInStatement: bills.filter((b) => !used.has(b.billId)),
    matchedBillIds: [...matched],
  };
}

// ── aging ──────────────────────────────────────────────────────────────

export const AGING_BUCKETS = [
  'current',
  'd1_30',
  'd31_60',
  'd61_90',
  'd90_plus',
] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export function agingBucket(daysPastDue: number): AgingBucket {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return 'd1_30';
  if (daysPastDue <= 60) return 'd31_60';
  if (daysPastDue <= 90) return 'd61_90';
  return 'd90_plus';
}

/** Whole days from `from` to `to` (YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}
