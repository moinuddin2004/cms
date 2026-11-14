import type { QuickRegisterValues } from '../schemas/quick-register.schema';
import type { PatientTeethChart, PrescriptionListItem } from '../types/patients.types';
import { latestTeethChart } from './latest-teeth-chart';
import { toCreatePatientInput } from './quick-register-input';
import { sortPrescriptions } from './sort-prescriptions';

const base: QuickRegisterValues = {
  fullName: ' Sara ',
  phone: ' 03001234567 ',
  gender: '',
  dob: '',
  isMinor: false,
  guardianName: 'G',
  guardianPhone: '03111111111',
  guardianRelation: 'Father',
};

describe('toCreatePatientInput', () => {
  it('trims, omits blanks and drops guardian fields for adults', () => {
    expect(toCreatePatientInput(base)).toEqual({
      fullName: 'Sara',
      phone: '03001234567',
      dob: undefined,
      gender: undefined,
      isMinor: false,
    });
  });

  it('keeps guardian fields for minors and a valid gender', () => {
    const out = toCreatePatientInput({
      ...base,
      isMinor: true,
      gender: 'female',
      dob: '2018-01-02',
      guardianRelation: ' ',
    });
    expect(out).toMatchObject({
      isMinor: true,
      gender: 'female',
      dob: '2018-01-02',
      guardianName: 'G',
      guardianPhone: '03111111111',
      guardianRelation: undefined,
    });
  });
});

describe('sortPrescriptions', () => {
  const rx = (id: string, status: PrescriptionListItem['status']) =>
    ({ id, status }) as PrescriptionListItem;
  it('puts drafts last and keeps order inside each group', () => {
    const out = sortPrescriptions([rx('1', 'DRAFT'), rx('2', 'AMENDED'), rx('3', 'FINALIZED'), rx('4', 'DRAFT')]);
    expect(out.map((p) => p.id)).toEqual(['2', '3', '1', '4']);
  });
});

describe('latestTeethChart', () => {
  const c = (id: string, recordedAt: string) => ({ id, recordedAt }) as PatientTeethChart;
  it('returns the newest or null', () => {
    expect(latestTeethChart([])).toBeNull();
    expect(
      latestTeethChart([c('a', '2026-02-01T00:00:00.000Z'), c('b', '2026-03-01T00:00:00.000Z'), c('c', '2026-01-01T00:00:00.000Z')])?.id,
    ).toBe('b');
  });
});
