import { OrderException } from '../common/order-errors';
import type { LabOrderItem } from '../entities/lab-order-item.entity';
import { assertSnapshotWrite, frozenChanges } from './snapshot-freeze';

const submitted: Partial<LabOrderItem> = {
  statusCode: 'pending_acceptance',
  quantity: 1,
  labUnitCostMinor: 500_000,
  labLineCostMinor: 500_000,
  optionIds: ['o1'],
  serviceNameSnap: 'Crown',
};

const code = (fn: () => void) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof OrderException ? e.code : 'other';
  }
};

describe('snapshot freeze (inv. 3)', () => {
  it('lists changed frozen fields only', () => {
    expect(
      frozenChanges(submitted, {
        ...submitted,
        labLineCostMinor: 1,
        statusCode: 'accepted',
        currentStageSeq: 2,
      }),
    ).toEqual(['labLineCostMinor']);
    expect(
      frozenChanges(submitted, { ...submitted, optionIds: ['o1'] }),
    ).toEqual([]);
    expect(frozenChanges(submitted, { optionIds: ['o2'] })).toEqual([
      'optionIds',
    ]);
  });

  it('refuses a direct price change on a submitted line', () => {
    expect(
      code(() =>
        assertSnapshotWrite(
          submitted,
          { ...submitted, labUnitCostMinor: 1 },
          undefined,
        ),
      ),
    ).toBe('LAB_ORDER_SNAPSHOT_FROZEN');
  });

  it('allows revisions, approved charges, drafts and non-frozen columns', () => {
    const change = { ...submitted, labLineCostMinor: 600_000 };
    expect(
      code(() => assertSnapshotWrite(submitted, change, 'revision')),
    ).toBeNull();
    expect(
      code(() => assertSnapshotWrite(submitted, change, 'charge')),
    ).toBeNull();
    expect(
      code(() =>
        assertSnapshotWrite(
          { ...submitted, statusCode: null },
          change,
          undefined,
        ),
      ),
    ).toBeNull();
    expect(
      code(() =>
        assertSnapshotWrite(
          submitted,
          { ...submitted, statusCode: 'accepted' },
          undefined,
        ),
      ),
    ).toBeNull();
    expect(
      code(() => assertSnapshotWrite(undefined, change, undefined)),
    ).toBeNull();
  });
});
