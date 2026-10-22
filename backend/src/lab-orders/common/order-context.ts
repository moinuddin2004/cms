import {
  ActorRef,
  ActorSide,
  TransitionVia,
} from 'src/common/audit/audit.enums';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import type { TransitionActor } from 'src/engine/runtime/runtime.types';
import type { ClinicActor } from 'src/labs/common/clinic-actor';
import type { LabActorContext } from 'src/labs/portal/lab-portal.constants';

/** Everything a clinic-side order call needs to know about the caller. */
export interface ClinicCall {
  tenant: TenantContext;
  actor: ClinicActor;
  ref: ActorRef;
}

/** A lab portal call: the member's lab + audit ref. */
export interface LabCall {
  lab: LabActorContext;
  ref: ActorRef;
}

export const clinicTransitionActor = (c: ClinicCall): TransitionActor => ({
  userId: c.actor.userId,
  side: 'clinic',
  roles: c.actor.roles,
  via: TransitionVia.APP,
  ip: c.ref.ip ?? null,
  requestId: c.ref.requestId ?? null,
});

export const labTransitionActor = (c: LabCall): TransitionActor => ({
  userId: c.lab.userId,
  side: 'lab',
  roles: [c.lab.role],
  via: TransitionVia.PORTAL,
  ip: c.ref.ip ?? null,
  requestId: c.ref.requestId ?? null,
});

export const labRef = (c: LabCall): ActorRef => ({
  ...c.ref,
  side: ActorSide.LAB,
});
