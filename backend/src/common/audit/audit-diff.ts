import type { EntityMetadata } from 'typeorm';

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
 * Every mapped column of `row` except `omit`, from the entity metadata — for
 * entities with many fields, where a hand-kept list would drift.
 */
export function columnSnapshot(
  metadata: EntityMetadata,
  row: object,
  omit: ReadonlySet<string>,
): Snapshot {
  const out: Snapshot = {};
  for (const column of metadata.columns) {
    const key = column.propertyName;
    // A join column without its own `xxxId` property maps to the relation
    // object itself — not a value worth recording.
    if (omit.has(key) || metadata.findRelationWithPropertyPath(key)) continue;
    out[key] = normalizeColumn(
      String(column.type),
      (row as Record<string, unknown>)[key],
    );
  }
  return out;
}

/**
 * Postgres returns numeric as a string and `date` as `YYYY-MM-DD`, while a
 * row edited in memory holds numbers and Dates — compare them on one form so
 * an unchanged value never reads as an edit.
 */
function normalizeColumn(type: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (type === 'decimal' || type === 'numeric') {
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }
  if (type === 'date') {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'string') return value.slice(0, 10);
  }
  return normalize(value);
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
