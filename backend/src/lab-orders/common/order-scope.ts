import { Brackets, SelectQueryBuilder } from 'typeorm';
import type { ClinicActor } from 'src/labs/common/clinic-actor';
import type { LabOrder } from '../entities/lab-order.entity';

/**
 * Row filter for `lab.orders.view` on a `lab_orders o` query:
 * - `own` → orders the caller is the doctor of, or created (a doctor who
 *   drafts an order for a colleague still sees it);
 * - `location` → orders of the active location;
 * - `org` → no filter; no grant → no rows.
 */
export function scopeOrders<T extends object>(
  qb: SelectQueryBuilder<T>,
  actor: ClinicActor,
): SelectQueryBuilder<T> {
  if (actor.access.scope('lab.orders.view') !== 'own') {
    return actor.access.applyScope(qb, 'lab.orders.view', {
      location: 'o.location_id',
    });
  }
  return qb.andWhere(
    new Brackets((w) => {
      w.where('o.created_by = :scopeUserId', { scopeUserId: actor.userId });
      if (actor.employeeId) {
        w.orWhere('o.doctor_id = :scopeDoctorId', {
          scopeDoctorId: actor.employeeId,
        });
      }
    }),
  );
}

/** The same rule as `scopeOrders`, for one loaded order. */
export function canSeeOrder(
  actor: ClinicActor,
  order: Pick<LabOrder, 'locationId' | 'doctorId' | 'createdBy'>,
): boolean {
  switch (actor.access.scope('lab.orders.view')) {
    case 'org':
      return true;
    case 'location':
      return order.locationId === actor.access.locationId;
    case 'own':
      return (
        order.createdBy === actor.userId ||
        (!!actor.employeeId && order.doctorId === actor.employeeId)
      );
    default:
      return false;
  }
}
