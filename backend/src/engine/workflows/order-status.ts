/**
 * Order status derivation (lab ERD §9c). An order's status follows its
 * items; whenever an item changes, the order is recomputed in the same
 * transaction. First matching rule wins.
 *
 * Item codes are those of the default item workflow. Items that left the
 * work (cancelled, rejected by the lab, superseded by a remake) don't count.
 */

/**
 * Statuses derivation never overrides: the ones only people set, and the
 * terminal ones (a completed or cancelled order stays that way).
 */
export const NON_DERIVABLE_ORDER_STATES = new Set([
  'draft',
  'clarification_needed',
  'rejected_by_lab',
  'cancelled',
  'completed',
]);

/** Item statuses that no longer count towards the order's progress. */
const OUT_OF_WORK = new Set(['cancelled', 'rejected', 'remake_required']);

/** Item statuses at or after clinic receipt. */
const RECEIVED_OR_LATER = new Set(['received', 'approved', 'delivered']);
const READY_OR_SHIPPED = new Set(['ready', 'dispatched']);
const IN_WORK = new Set(['in_production', 'at_clinic_tryin', 'qc']);
const FINISHED = new Set(['approved', 'delivered']);

export interface OrderDerivationInput {
  itemStatuses: string[];
  /** A manual hold is on the order. */
  onHold: boolean;
}

export function deriveOrderStatus({
  itemStatuses,
  onHold,
}: OrderDerivationInput): string {
  // 1. Every item cancelled → cancelled.
  if (itemStatuses.length && itemStatuses.every((s) => s === 'cancelled')) {
    return 'cancelled';
  }
  // 2. Manual hold.
  if (onHold) return 'on_hold';

  const items = itemStatuses.filter((s) => !OUT_OF_WORK.has(s));
  if (!items.length) return 'submitted';
  const all = (set: Set<string>) => items.every((s) => set.has(s));
  const any = (set: Set<string>) => items.some((s) => set.has(s));

  if (all(FINISHED)) return 'completed'; // 3
  if (all(RECEIVED_OR_LATER)) return 'under_review'; // 4
  if (any(RECEIVED_OR_LATER)) return 'partially_received'; // 5
  if (all(READY_OR_SHIPPED)) return 'ready'; // 6
  if (any(READY_OR_SHIPPED)) return 'partially_ready'; // 7
  if (any(IN_WORK)) return 'in_progress'; // 8
  if (items.every((s) => s === 'accepted')) return 'accepted'; // 9
  return 'submitted'; // 10
}

/** Whether the order's current status may be replaced by a derived one. */
export const isDerivable = (current: string): boolean =>
  !NON_DERIVABLE_ORDER_STATES.has(current);
