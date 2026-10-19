export type Snapshot = Record<string, unknown>;

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value === undefined ? null : value;
}

/** Plain JSON-safe copy of the listed fields (Dates become ISO strings). */
export function snapshotOf<T extends object>(
  entity: T,
  fields: readonly (keyof T & string)[],
): Snapshot {
  const out: Snapshot = {};
  for (const f of fields) out[f] = normalize(entity[f]);
  return out;
}

/**
 * Only the fields whose value differs, as `{ before, after }`; null when
 * nothing changed (callers then skip the audit row — a no-op save is not
 * an event).
 */
export function diffSnapshots(
  before: Snapshot,
  after: Snapshot,
): { before: Snapshot; after: Snapshot } | null {
  const b: Snapshot = {};
  const a: Snapshot = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const from = normalize(before[key]);
    const to = normalize(after[key]);
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    b[key] = from;
    a[key] = to;
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}
