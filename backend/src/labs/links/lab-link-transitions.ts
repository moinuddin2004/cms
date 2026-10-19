import { ActorSide } from 'src/common/audit/audit.enums';
import { labError } from '../common/lab-errors';
import { LabLinkStatus } from '../enums/lab.enums';

export type LabLinkAction = 'activate' | 'suspend' | 'reactivate';

interface LinkTransition {
  from: readonly LabLinkStatus[];
  to: LabLinkStatus;
  sides: readonly ActorSide[];
  requiresReason: boolean;
}

/**
 * Lab ↔ clinic link lifecycle: invited → active ⇄ suspended.
 *
 * - Activate: the lab accepting (lab side, from the lab portal) or the clinic
 *   confirming the lab on its behalf — until the portal ships every lab is
 *   activated by the clinic.
 * - Suspend: either party stops working with the other; a reason is kept.
 * - Reactivate: only by the side that suspended (checked by the service from
 *   status_history), so a clinic cannot undo a lab's suspension or vice versa.
 *
 * Platform admins can perform every action.
 */
export const LINK_TRANSITIONS: Record<LabLinkAction, LinkTransition> = {
  activate: {
    from: [LabLinkStatus.INVITED],
    to: LabLinkStatus.ACTIVE,
    sides: [ActorSide.CLINIC, ActorSide.LAB, ActorSide.PLATFORM],
    requiresReason: false,
  },
  suspend: {
    from: [LabLinkStatus.INVITED, LabLinkStatus.ACTIVE],
    to: LabLinkStatus.SUSPENDED,
    sides: [ActorSide.CLINIC, ActorSide.LAB, ActorSide.PLATFORM],
    requiresReason: true,
  },
  reactivate: {
    from: [LabLinkStatus.SUSPENDED],
    to: LabLinkStatus.ACTIVE,
    sides: [ActorSide.CLINIC, ActorSide.LAB, ActorSide.PLATFORM],
    requiresReason: false,
  },
};

/** Validates `action` from `current` for `side`; returns the target status. */
export function resolveLinkTransition(
  current: LabLinkStatus,
  action: LabLinkAction,
  side: ActorSide,
  reason: string | null | undefined,
): LabLinkStatus {
  const t = LINK_TRANSITIONS[action];
  if (!t.from.includes(current) || !t.sides.includes(side)) {
    throw labError(
      'INVALID_TRANSITION',
      `Cannot ${action} a link that is ${current}`,
      { from: current, action },
    );
  }
  if (t.requiresReason && !reason?.trim()) {
    throw labError(
      'LAB_LINK_REASON_REQUIRED',
      `A reason is required to ${action}`,
    );
  }
  return t.to;
}

/**
 * A suspension may only be lifted by the side that made it (platform admins
 * excepted). `suspendedBy` is null for links suspended before history existed.
 */
export function canLiftSuspension(
  suspendedBy: ActorSide | null,
  side: ActorSide,
): boolean {
  if (side === ActorSide.PLATFORM || suspendedBy === null) return true;
  if (suspendedBy === ActorSide.PLATFORM) return false;
  return suspendedBy === side;
}
