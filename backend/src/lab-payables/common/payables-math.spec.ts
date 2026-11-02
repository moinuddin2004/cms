import { checkJournal } from 'src/billing/ledger/journal/general-ledger.service';
import {
  BillLineKind,
  StatementMatch,
  VendorBillStatus,
} from '../enums/payables.enums';
import {
  agingBucket,
  applyBp,
  billTotals,
  ExpectedCost,
  planDraftLines,
  reconcile,
  settledStatus,
} from './payables-math';

const cost = (key: string, total: number, qty = 1): ExpectedCost => ({
  key,
  kind: BillLineKind.SERVICE,
  orderItemId: key.slice(5),
  chargeRequestId: null,
  remakeRequestId: null,
  description: key,
  quantity: qty,
  unitCostMinor: total / qty,
  totalMinor: total,
});

describe('bill math', () => {
  it('tax in basis points, rounded half up; total = subtotal + tax', () => {
    expect(applyBp(1_000_000, 0)).toBe(0);
    expect(applyBp(1_000_000, 1700)).toBe(170_000);
    expect(applyBp(333, 1500)).toBe(50); // 49.95 → 50
    expect(
      billTotals([{ lineTotalMinor: 500_000 }, { lineTotalMinor: 500_000 }], 0),
    ).toEqual({
      subtotalMinor: 1_000_000,
      taxMinor: 0,
      totalMinor: 1_000_000,
    });
  });

  it('settled status follows what was allocated', () => {
    expect(settledStatus(1000, 0)).toBe(VendorBillStatus.APPROVED);
    expect(settledStatus(1000, 600)).toBe(VendorBillStatus.PARTIALLY_PAID);
    expect(settledStatus(1000, 1000)).toBe(VendorBillStatus.PAID);
  });

  it('aging buckets by days past due', () => {
    expect([-3, 0, 1, 30, 31, 60, 61, 90, 91].map(agingBucket)).toEqual([
      'current',
      'current',
      'd1_30',
      'd1_30',
      'd31_60',
      'd31_60',
      'd61_90',
      'd61_90',
      'd90_plus',
    ]);
  });

  it('journals must balance (inv. 6)', () => {
    expect(
      checkJournal([
        { accountCode: 'LAB_COST', debitMinor: 10 },
        { accountCode: 'LAB_PAYABLE', creditMinor: 10 },
      ]),
    ).toBe(10);
    expect(() =>
      checkJournal([
        { accountCode: 'LAB_COST', debitMinor: 10 },
        { accountCode: 'LAB_PAYABLE', creditMinor: 9 },
      ]),
    ).toThrow(/balance/);
    expect(() =>
      checkJournal([{ accountCode: 'X', debitMinor: 5, creditMinor: 5 }]),
    ).toThrow();
    expect(() =>
      checkJournal([
        { accountCode: 'X', debitMinor: -5 },
        { accountCode: 'Y', creditMinor: -5 },
      ]),
    ).toThrow();
  });
});

describe('planDraftLines', () => {
  it('first accept: one line per accepted item, opens a draft', () => {
    const plan = planDraftLines(
      [cost('item:a', 500_000, 2)],
      new Map(),
      [],
      false,
    );
    expect(plan.needsDraft).toBe(true);
    expect(plan.inserts).toMatchObject([
      {
        key: 'item:a',
        quantity: 2,
        unitCostMinor: 250_000,
        lineMinor: 500_000,
      },
    ]);
  });

  it('re-run is idempotent; a changed cost updates the draft line', () => {
    const lines = [{ id: 'l1', key: 'item:a', lineTotalMinor: 500_000 }];
    expect(
      planDraftLines([cost('item:a', 500_000)], new Map(), lines, true),
    ).toMatchObject({
      inserts: [],
      updates: [],
    });
    expect(
      planDraftLines([cost('item:a', 550_000)], new Map(), lines, true).updates,
    ).toEqual([
      { id: 'l1', lineMinor: 550_000, quantity: 1, unitCostMinor: 550_000 },
    ]);
  });

  it('a lab-fault remake (0) never opens a draft, but is listed on an open one', () => {
    expect(
      planDraftLines([cost('item:r', 0)], new Map(), [], false),
    ).toMatchObject({
      inserts: [],
      needsDraft: false,
    });
    expect(
      planDraftLines([cost('item:r', 0)], new Map(), [], true).inserts,
    ).toHaveLength(1);
  });

  it('after approval only the difference goes on a new draft', () => {
    const plan = planDraftLines(
      [cost('item:a', 600_000)],
      new Map([['item:a', 500_000]]),
      [],
      false,
    );
    expect(plan.needsDraft).toBe(true);
    expect(plan.inserts).toMatchObject([
      {
        lineMinor: 100_000,
        quantity: 1,
        unitCostMinor: 100_000,
        description: 'item:a (additional)',
      },
    ]);
    expect(
      planDraftLines(
        [cost('item:a', 500_000)],
        new Map([['item:a', 500_000]]),
        [],
        false,
      ).inserts,
    ).toEqual([]);
  });
});

describe('reconcile', () => {
  const bills = [
    {
      billId: 'b1',
      billNo: 'VB-0001',
      vendorInvoiceNo: 'INV-77',
      orderNo: 'LAB-0001',
      totalMinor: 1_000_000,
      firstLineId: 'l1',
    },
    {
      billId: 'b2',
      billNo: 'VB-0002',
      vendorInvoiceNo: null,
      orderNo: 'LAB-0002',
      totalMinor: 200_000,
      firstLineId: 'l2',
    },
    {
      billId: 'b3',
      billNo: 'VB-0003',
      vendorInvoiceNo: null,
      orderNo: 'LAB-0003',
      totalMinor: 300_000,
      firstLineId: 'l3',
    },
  ];

  it('matched, amount mismatch, missing in system, missing in statement', () => {
    const r = reconcile(
      [
        { labReference: 'lab-0001', amountMinor: 1_000_000 },
        { labReference: 'VB-0002', amountMinor: 250_000 },
        { labReference: 'LAB-9999', amountMinor: 50_000 },
      ],
      bills,
    );
    expect(r.lines.map((l) => l.matchStatus)).toEqual([
      StatementMatch.MATCHED,
      StatementMatch.AMOUNT_MISMATCH,
      StatementMatch.MISSING_IN_SYSTEM,
    ]);
    expect(r.lines[0]).toMatchObject({
      matchedBillId: 'b1',
      matchedBillLineId: 'l1',
    });
    expect(r.lines[1].systemAmountMinor).toBe(200_000);
    expect(r.missingInStatement.map((b) => b.billId)).toEqual(['b3']);
    expect(r.matchedBillIds).toEqual(['b1']);
  });

  it("an order's bills count together, and each bill is used once", () => {
    const extra = {
      billId: 'b4',
      billNo: 'VB-0004',
      vendorInvoiceNo: null,
      orderNo: 'LAB-0001',
      totalMinor: 100_000,
      firstLineId: 'l4',
    };
    const r = reconcile(
      [
        { labReference: 'LAB-0001', amountMinor: 1_100_000 },
        { labReference: 'LAB-0001', amountMinor: 1_100_000 },
      ],
      [...bills, extra],
    );
    expect(r.lines.map((l) => l.matchStatus)).toEqual([
      StatementMatch.MATCHED,
      StatementMatch.MISSING_IN_SYSTEM,
    ]);
    expect(r.matchedBillIds.sort()).toEqual(['b1', 'b4']);
  });
});
