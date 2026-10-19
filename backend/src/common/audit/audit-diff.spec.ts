import { diffSnapshots, snapshotOf } from './audit-diff';

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
