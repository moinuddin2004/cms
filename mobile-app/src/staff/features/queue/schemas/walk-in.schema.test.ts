import { toWalkInInput } from '../lib/walk-in-input';
import { walkInDefaults, walkInSchema, type WalkInValues } from './walk-in.schema';

const base = (over: Partial<WalkInValues> = {}): WalkInValues => ({
  ...walkInDefaults('doc-1'),
  ...over,
});

const issues = (v: WalkInValues) => {
  const r = walkInSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

// The patients barrel pulls in whole pages; the schema only needs this validator.
jest.mock('@/staff/features/patients', () =>
  jest.requireActual('../../patients/schemas/quick-register.schema'),
);

describe('walkInSchema', () => {
  it('needs a doctor', () => {
    expect(issues(base({ doctorId: '', mode: 'existing', patientId: 'p' }))[0]).toMatch(/^doctorId/);
  });

  it('existing patient: needs a chosen patient', () => {
    expect(issues(base())).toEqual(['patientId: Choose a patient']);
    expect(issues(base({ patientId: 'p1', patientLabel: 'Hina' }))).toEqual([]);
  });

  it('new patient: name and a valid phone are required', () => {
    expect(issues(base({ mode: 'new' }))).toEqual([
      'fullName: Enter the full name',
      'phone: Enter a phone number',
    ]);
    expect(issues(base({ mode: 'new', fullName: 'Hina', phone: '12' }))[0]).toMatch(/^phone: Enter a valid/);
    expect(issues(base({ mode: 'new', fullName: 'Hina', phone: '0300 1234567' }))).toEqual([]);
  });

  it('whitespace-only name does not count', () => {
    expect(issues(base({ mode: 'new', fullName: '   ', phone: '03001234567' }))).toEqual([
      'fullName: Enter the full name',
    ]);
  });

  it('urgent needs a reason', () => {
    expect(issues(base({ patientId: 'p1', urgent: true }))).toEqual([
      'urgentReason: Enter the urgent reason',
    ]);
    expect(issues(base({ patientId: 'p1', urgent: true, urgentReason: 'Bleeding' }))).toEqual([]);
  });
});

describe('toWalkInInput', () => {
  it('existing patient sends the id only (no name / phone)', () => {
    expect(toWalkInInput(base({ patientId: 'p1', patientLabel: 'Hina', fullName: 'stale' }))).toEqual({
      doctorId: 'doc-1',
      patientId: 'p1',
    });
  });

  it('new patient sends name + phone, trimmed; reason and urgent only when set', () => {
    expect(
      toWalkInInput(
        base({
          mode: 'new',
          fullName: ' Hina ',
          phone: ' 03001234567 ',
          reasonForVisit: ' Toothache ',
          urgent: true,
          urgentReason: ' Swelling ',
        }),
      ),
    ).toEqual({
      doctorId: 'doc-1',
      patientName: 'Hina',
      patientPhone: '03001234567',
      reasonForVisit: 'Toothache',
      urgentReason: 'Swelling',
    });
  });

  it('drops a stale urgent reason when the toggle is off and never sends force', () => {
    const out = toWalkInInput(base({ patientId: 'p1', urgentReason: 'old' }));
    expect(out).not.toHaveProperty('urgentReason');
    expect(out).not.toHaveProperty('force');
  });
});
