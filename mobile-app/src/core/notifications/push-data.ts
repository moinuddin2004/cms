import type { Space } from '@/core/space/useSpaceStore';

/**
 * The `data` object every remote push carries (docs/02 §8). Typed and checked here once; every
 * field is untrusted input — it may pick a screen but never grants access (docs/03 §2.4).
 */
export interface PushData {
  space: Space;
  type: string | null;
  /** The notification's `link` (e.g. `/patients/<id>`), mapped to a screen by the space. */
  route: string | null;
  organizationId: string | null;
  locationId: string | null;
  entityId: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

/** `null` when the payload is not one of ours. */
export function parsePushData(raw: unknown): PushData | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (d.space !== 'staff' && d.space !== 'patient') return null;
  return {
    space: d.space,
    type: str(d.type),
    route: str(d.route),
    organizationId: str(d.organizationId),
    locationId: str(d.locationId),
    entityId: str(d.entityId),
  };
}
