import type { PushData } from '@/core/notifications/push-data';

/** A route a patient push may open. Anything else is ignored. */
export type PatientPushRoute =
  | { kind: 'visit'; entryId: string }
  | { kind: 'appointment'; id: string };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Maps a tapped push to a patient screen. The payload is only a routing hint (docs/03 §2.4): the
 * route must match one of our two shapes with a plain id, else the tap opens nothing; the screens
 * and the API still enforce access.
 */
export function resolvePatientPushRoute(data: PushData): PatientPushRoute | null {
  if (data.space !== 'patient') return null;
  const m = /^\/(visit|appointments)\/([^/?#]+)$/.exec(data.route ?? '');
  if (m && ID.test(m[2])) {
    return m[1] === 'visit' ? { kind: 'visit', entryId: m[2] } : { kind: 'appointment', id: m[2] };
  }
  // A queue push without a usable route still points at its entry.
  if (data.type?.startsWith('queue.') && data.entityId && ID.test(data.entityId)) {
    return { kind: 'visit', entryId: data.entityId };
  }
  return null;
}

export const hrefOf = (r: PatientPushRoute): string =>
  r.kind === 'visit' ? `/visit/${r.entryId}` : `/appointments/${r.id}`;
