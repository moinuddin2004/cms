import type { AccessContext } from 'src/access/access-context';
import type { Permission } from 'src/access/catalog/permissions';
import { noPermission } from 'src/access/decorators/access.decorators';

/**
 * Who is acting on the queue, reduced to the queue permissions the
 * orchestrator's rules need. Built from the request's AccessContext
 * (`queueActorFrom`) — the orchestrator never looks at role names.
 */
export interface QueueActor {
  userId: string;
  /** The user's employee id at this location, when they have one. */
  employeeId: string | null;
  /** `queue.doctor.any` — doctor actions in any doctor's session. */
  anyDoctor: boolean;
  /** `queue.doctor.own` — doctor actions in the user's own session. */
  ownDoctor: boolean;
  /** `queue.checkin` — arrivals (check-in, walk-in, back from test). */
  checkIn: boolean;
  /** `queue.entry.manage` — skip, rejoin, remove, transfer any entry. */
  manageEntries: boolean;
  /** `queue.entry.reprioritize` — urgent priority, smart/FIFO for today. */
  reprioritize: boolean;
  /** Written to `queue_events.actor_role` for the audit trail. */
  label: string;
}

/** Actor used by background jobs (no user): every rule passes. */
export const SYSTEM_ACTOR: QueueActor = {
  userId: '00000000-0000-0000-0000-000000000000',
  employeeId: null,
  anyDoctor: true,
  ownDoctor: true,
  checkIn: true,
  manageEntries: true,
  reprioritize: true,
  label: 'system',
};

export function queueActorFrom(access: AccessContext): QueueActor {
  const label = access.isSuperAdmin
    ? 'super_admin'
    : access.isOwner
      ? 'owner'
      : access.roles.map((r) => r.templateKey ?? r.name).join(',') || 'member';
  return {
    userId: access.userId,
    employeeId: access.employeeId,
    anyDoctor: access.can('queue.doctor.any'),
    ownDoctor: access.can('queue.doctor.own'),
    checkIn: access.can('queue.checkin'),
    manageEntries: access.can('queue.entry.manage'),
    reprioritize: access.can('queue.entry.reprioritize'),
    label,
  };
}

/** Doctor actions in `doctorId`'s session: any doctor, or this is your own. */
export function canRunSession(actor: QueueActor, doctorId: string): boolean {
  return (
    actor.anyDoctor ||
    (actor.ownDoctor && !!actor.employeeId && actor.employeeId === doctorId)
  );
}

/** Skip / transfer: entry managers anywhere; doctors in their own session. */
export function canHandleEntry(actor: QueueActor, doctorId: string): boolean {
  return actor.manageEntries || canRunSession(actor, doctorId);
}

/** Open (ensure) a doctor's session for today: reception, or that doctor. */
export function canOpenSession(actor: QueueActor, doctorId: string): boolean {
  return actor.checkIn || canRunSession(actor, doctorId);
}

/**
 * Any-of check for routes two kinds of staff use (e.g. the reception board
 * and the doctor screen both read a session). `@Can` is all-of, so these
 * routes are `@AnyMember()` and call this first.
 */
export function assertAnyOf(access: AccessContext, ...perms: Permission[]) {
  if (perms.some((p) => access.can(p))) return;
  throw noPermission(
    perms,
    `Needs one of these permissions: ${perms.join(', ')}`,
  );
}
