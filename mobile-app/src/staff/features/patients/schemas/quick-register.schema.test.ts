import { quickRegisterSchema } from './quick-register.schema';

// The real module reads the active location from the auth store; the schema
// only needs "today" and the YYYY-MM-DD shape check.
jest.mock('@/staff/lib/datetime', () => ({
  todayYmd: () => '2026-11-11',
  isYmd: (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v),
}));

const valid = { fullName: 'Ali Raza', phone: '0300 123-4567', isMinor: false };

const issuePaths = (input: unknown) => {
  const r = quickRegisterSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('quickRegisterSchema', () => {
  it('accepts the minimum and trims', () => {
    const r = quickRegisterSchema.safeParse({ ...valid, fullName: '  Ali Raza ' });
    expect(r.success && r.data).toEqual({
      fullName: 'Ali Raza',
      phone: '0300 123-4567',
      isMinor: false,
      gender: undefined,
      dob: undefined,
      guardianName: undefined,
      guardianPhone: undefined,
      guardianRelation: undefined,
    });
  });

  it.each([
    ['empty name', { fullName: '   ' }, 'fullName'],
    ['name too long', { fullName: 'a'.repeat(151) }, 'fullName'],
    ['empty phone', { phone: '' }, 'phone'],
    ['phone too long', { phone: '1'.repeat(21) }, 'phone'],
    ['phone letters', { phone: '0300abc' }, 'phone'],
    ['bad gender', { gender: 'x' }, 'gender'],
    ['dob wrong format', { dob: '11/11/2000' }, 'dob'],
    ['dob impossible', { dob: '2026-02-30' }, 'dob'],
    ['dob tomorrow', { dob: '2026-11-12' }, 'dob'],
    ['phone dashes only', { phone: '---' }, 'phone'],
    ['phone plus only', { phone: '+' }, 'phone'],
    ['phone too few digits', { phone: '03001' }, 'phone'],
    ['phone tab', { phone: '0300\t1234567' }, 'phone'],
    ['phone newline', { phone: '0300\n1234567' }, 'phone'],
    ['guardian phone letters', { guardianPhone: 'abc' }, 'guardianPhone'],
    ['guardian phone dashes', { guardianPhone: '---' }, 'guardianPhone'],
    ['guardian phone few digits', { guardianPhone: '123' }, 'guardianPhone'],
  ])('rejects %s', (_label, patch, path) => {
    expect(issuePaths({ ...valid, ...patch })).toContain(path);
  });

  it.each([
    ['dob today', { dob: '2026-11-11' }],
    ['dob in the past', { dob: '1990-05-01' }],
    ['phone with +', { phone: '+92 300 1234567' }],
    ['all genders', { gender: 'other' }],
    ['blank dob', { dob: '' }],
    ['empty gender', { gender: '' }],
    ['guardian ignored when not a minor', { guardianName: 'Ahmed' }],
  ])('accepts %s', (_label, patch) => {
    expect(quickRegisterSchema.safeParse({ ...valid, ...patch }).success).toBe(true);
  });

  it('maps empty gender to undefined', () => {
    const r = quickRegisterSchema.safeParse({ ...valid, gender: '' });
    expect(r.success && r.data.gender).toBeUndefined();
  });

  it('drops guardian fields when not a minor', () => {
    const r = quickRegisterSchema.safeParse({
      ...valid,
      guardianName: 'Ahmed',
      guardianPhone: '0300 1111111',
      guardianRelation: 'Father',
    });
    expect(r.success && r.data).toMatchObject({
      guardianName: undefined,
      guardianPhone: undefined,
      guardianRelation: undefined,
    });
  });

  describe('isMinor', () => {
    it('requires guardian name and phone', () => {
      expect(issuePaths({ ...valid, isMinor: true })).toEqual(['guardianName', 'guardianPhone']);
    });

    it.each([
      ['name only', { guardianName: 'Ahmed' }, ['guardianPhone']],
      ['phone only', { guardianPhone: '0300 1111111' }, ['guardianName']],
      ['blank strings', { guardianName: ' ', guardianPhone: ' ' }, ['guardianName', 'guardianPhone']],
    ])('rejects %s', (_label, patch, paths) => {
      expect(issuePaths({ ...valid, isMinor: true, ...patch })).toEqual(paths);
    });

    it('accepts a full guardian', () => {
      const r = quickRegisterSchema.safeParse({
        ...valid,
        isMinor: true,
        guardianName: 'Ahmed',
        guardianPhone: '0300 1111111',
        guardianRelation: 'Father',
      });
      expect(r.success && r.data.guardianRelation).toBe('Father');
    });
  });
});
