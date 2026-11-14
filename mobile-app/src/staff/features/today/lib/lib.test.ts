import type { BoardResponse, EntryView, QueueLane } from '@/staff/features/queue';

import { fromDailySummary, fromInvoiceStats } from './collections';
import { toDoctorsNow } from './doctors-now';
import { visibleTodayBlocks } from './today-blocks';

const grants = (...perms: string[]) => {
  const set = new Set(perms);
  return (p: string) => set.has(p);
};
const noFeatures = () => false;

describe('visibleTodayBlocks', () => {
  it('owner sees every block, in screen order', () => {
    const can = grants(
      'appointments.view',
      'billing.invoice.view',
      'reports.financial.view',
      'queue.board.view',
    );
    expect(visibleTodayBlocks(can, () => true)).toEqual(['stats', 'collections', 'doctors', 'next']);
  });

  it('receptionist: appointments + queue board, no money', () => {
    const can = grants('appointments.view', 'queue.board.view');
    expect(visibleTodayBlocks(can, noFeatures)).toEqual(['stats', 'doctors', 'next']);
  });

  it('doctor (own queue only): nothing from the clinic snapshot', () => {
    const can = grants('queue.doctor.own', 'patients.view');
    expect(visibleTodayBlocks(can, noFeatures)).toEqual([]);
  });

  it('billing-only user still gets the collections block (invoice-stats fallback)', () => {
    expect(visibleTodayBlocks(grants('billing.invoice.view'), noFeatures)).toEqual(['collections']);
  });
});

const entry = (id: string, token: string, status: EntryView['status']) =>
  ({ id, token, status }) as EntryView;

const lane = (
  id: string,
  name: string,
  session: { status: string } | null,
  entries: EntryView[] = [],
): QueueLane =>
  ({
    doctor: { id, fullName: name },
    snapshot: session ? { session, entries } : null,
  }) as unknown as QueueLane;

describe('toDoctorsNow', () => {
  it('maps lanes: serving token, waiting count, status, no-session', () => {
    const board = {
      lanes: [
        lane('d1', 'Dr. Sana', { status: 'open' }, [
          entry('e1', 'A-012', 'in_consultation'),
          entry('e2', 'A-013', 'waiting'),
          entry('e3', 'A-014', 'waiting'),
          entry('e4', 'A-015', 'on_hold'),
          entry('e5', 'A-011', 'completed'),
          entry('e6', 'A-016', 'skipped'),
        ]),
        lane('d2', 'Dr. Imran', { status: 'paused' }, [entry('e7', 'B-001', 'waiting')]),
        lane('d3', 'Dr. Ali', null),
        lane('d4', 'Dr. Zoya', { status: 'open' }, [
          entry('e8', 'D-002', 'called'),
          entry('e9', 'D-001', 'in_consultation'),
        ]),
      ],
    } as unknown as BoardResponse;

    expect(toDoctorsNow(board)).toEqual([
      {
        doctorId: 'd1',
        doctorName: 'Dr. Sana',
        status: 'open',
        nowServing: 'A-012',
        nowServingStatus: 'in_consultation',
        waitingCount: 2,
      },
      {
        doctorId: 'd2',
        doctorName: 'Dr. Imran',
        status: 'paused',
        nowServing: null,
        nowServingStatus: null,
        waitingCount: 1,
      },
      {
        doctorId: 'd3',
        doctorName: 'Dr. Ali',
        status: 'no_session',
        nowServing: null,
        nowServingStatus: null,
        waitingCount: 0,
      },
      {
        doctorId: 'd4',
        doctorName: 'Dr. Zoya',
        status: 'open',
        nowServing: 'D-001',
        nowServingStatus: 'in_consultation',
        waitingCount: 0,
      },
    ]);
  });

  it('shows a called patient when nobody is in consultation', () => {
    const board = {
      lanes: [lane('d1', 'Dr. A', { status: 'open' }, [entry('e1', 'A-001', 'called')])],
    } as unknown as BoardResponse;
    expect(toDoctorsNow(board)[0]).toMatchObject({ nowServing: 'A-001', nowServingStatus: 'called' });
  });

  it('empty board → empty list', () => {
    expect(toDoctorsNow({ lanes: [] } as unknown as BoardResponse)).toEqual([]);
  });
});

describe('collections mapping', () => {
  it('daily summary keeps decimal amounts untouched', () => {
    expect(
      fromDailySummary({
        totalCollections: 1234.56,
        invoicesGenerated: 4,
        paymentMethodBreakdown: { Cash: 1234.56 },
        outstandingAmount: 99.5,
        overdueCount: 1,
      }),
    ).toMatchObject({ source: 'daily', collected: 1234.56, outstanding: 99.5, overdueCount: 1 });
  });

  it('invoice stats: unpaid = UNPAID + PARTIALLY_PAID + OVERDUE', () => {
    const out = fromInvoiceStats({
      counts: { UNPAID: 2, PARTIALLY_PAID: 1, OVERDUE: 4, PAID: 9, REFUNDED: 1, CANCELLED: 1 },
      totals: { invoiced: 10, collected: 5, outstanding: 5, overdue: 2, refunded: 0 },
    });
    expect(out.unpaidCount).toBe(7);
    expect(out.overdueCount).toBe(4);
  });
});
