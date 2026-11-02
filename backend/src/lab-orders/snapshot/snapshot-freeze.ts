import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { orderError } from '../common/order-errors';
import { LabOrderItem } from '../entities/lab-order-item.entity';

/**
 * Snapshot freeze (lab ERD inv. 3). After submit an item's snapshot and
 * price columns change only through a revision or an approved charge
 * request. There are no migration files, so instead of a DB trigger this is
 * enforced in the app: every `save()` of a submitted item is checked, and
 * the two allowed writers pass `{ data: { snapshotChange: … } }`.
 */
export const FROZEN_ITEM_FIELDS = [
  'labServiceId',
  'clinicTreatmentId',
  'optionIds',
  'rush',
  'quantity',
  'serviceCodeSnap',
  'serviceNameSnap',
  'unitType',
  'optionsSnap',
  'labPriceId',
  'currency',
  'labUnitCostMinor',
  'labLineCostMinor',
  'patientUnitPriceMinor',
  'patientLinePriceMinor',
  'pricedOn',
  'formSchemaVersionId',
  'workflowTemplateVersionId',
] as const satisfies readonly (keyof LabOrderItem)[];

/** Who may change frozen columns of a submitted item. */
export type SnapshotChange = 'revision' | 'charge';

export interface SnapshotWriteData {
  snapshotChange?: SnapshotChange;
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Frozen fields that differ between the stored row and the one being saved. */
export function frozenChanges(
  stored: Partial<LabOrderItem>,
  next: Partial<LabOrderItem>,
): string[] {
  return FROZEN_ITEM_FIELDS.filter(
    (f) => f in next && !same(stored[f], next[f]),
  );
}

/**
 * Throws when a submitted item's frozen columns would change outside a
 * revision / approved charge. Draft items (no status yet) are free.
 */
export function assertSnapshotWrite(
  stored: Partial<LabOrderItem> | undefined,
  next: Partial<LabOrderItem>,
  change: SnapshotChange | undefined,
): void {
  if (!stored || stored.statusCode == null || change) return;
  const changed = frozenChanges(stored, next);
  if (changed.length) {
    throw orderError(
      'LAB_ORDER_SNAPSHOT_FROZEN',
      'A submitted line can only change through a revision or an approved charge',
      { fields: changed },
    );
  }
}

@Injectable()
export class SnapshotFreezeSubscriber
  implements EntitySubscriberInterface<LabOrderItem>
{
  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return LabOrderItem;
  }

  beforeUpdate(event: UpdateEvent<LabOrderItem>): void {
    const data = (event.queryRunner.data ?? {}) as SnapshotWriteData;
    assertSnapshotWrite(
      event.databaseEntity,
      (event.entity ?? {}) as Partial<LabOrderItem>,
      data.snapshotChange,
    );
  }
}
