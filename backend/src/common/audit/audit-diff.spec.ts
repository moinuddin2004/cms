import type { EntityMetadata } from 'typeorm';
import { columnSnapshot, diffSnapshots, snapshotOf } from './audit-diff';

describe('audit diff', () => {
  it('keeps only the listed fields and serialises dates', () => {
    const at = new Date('2026-10-19T10:00:00.000Z');
    expect(
      snapshotOf({ a: 1, b: at, c: undefined, secret: 'x' }, ['a', 'b', 'c']),
    ).toEqual({ a: 1, b: '2026-10-19T10:00:00.000Z', c: null });
  });

  it('returns only changed fields', () => {
    expect(
      diffSnapshots(
        { name: 'Lab', city: 'Karachi', terms: 30 },
        { name: 'Lab', city: 'Lahore', terms: 45 },
      ),
    ).toEqual({
      before: { city: 'Karachi', terms: 30 },
      after: { city: 'Lahore', terms: 45 },
    });
  });

  it('treats undefined and null as equal and compares objects by value', () => {
    expect(
      diffSnapshots({ a: null, tags: ['x'] }, { a: undefined, tags: ['x'] }),
    ).toBeNull();
  });

  it('includes keys present on one side only', () => {
    expect(diffSnapshots({}, { a: 1 })).toEqual({
      before: { a: null },
      after: { a: 1 },
    });
  });
});

describe('columnSnapshot', () => {
  // Just what columnSnapshot reads from TypeORM's EntityMetadata.
  const metadata = {
    columns: [
      { propertyName: 'id', type: 'uuid' },
      { propertyName: 'fullName', type: 'varchar' },
      { propertyName: 'fee', type: 'decimal' },
      { propertyName: 'dob', type: 'date' },
      { propertyName: 'seenAt', type: 'timestamptz' },
      { propertyName: 'location', type: 'uuid' },
    ],
    findRelationWithPropertyPath: (key: string) =>
      key === 'location' ? {} : undefined,
  } as unknown as EntityMetadata;
  const omit = new Set(['id']);

  it('skips omitted columns and relation objects', () => {
    expect(
      columnSnapshot(
        metadata,
        { id: 'x', fullName: 'Ali', location: { id: 'l1' } },
        omit,
      ),
    ).toEqual({ fullName: 'Ali', fee: null, dob: null, seenAt: null });
  });

  it('reads a reloaded row and an edited row the same way', () => {
    const fromDb = columnSnapshot(
      metadata,
      { fullName: 'Ali', fee: '1500.00', dob: '1990-05-01', seenAt: null },
      omit,
    );
    const edited = columnSnapshot(
      metadata,
      { fullName: 'Ali', fee: 1500, dob: new Date('1990-05-01') },
      omit,
    );
    expect(diffSnapshots(fromDb, edited)).toBeNull();
  });
});
