import type { Vitals } from '../types/patients.types';
import {
  ageLabel,
  chartConditions,
  fmtNum,
  isPatientId,
  patientSubtitle,
  telUrl,
  visibleSegments,
  vitalsParts,
  whatsappUrl,
  dialCodeForCurrency,
} from './patient-detail';

describe('isPatientId', () => {
  it.each([
    ['0b2f0c6e-8f7d-4a53-9a55-6f9d5b1c2e11', true],
    ['0B2F0C6E-8F7D-4A53-9A55-6F9D5B1C2E11', true],
    ['', false],
    ['abc', false],
    ['../patients', false],
    ['0b2f0c6e-8f7d-4a53-9a55-6f9d5b1c2e11/history', false],
    [undefined, false],
    [42, false],
  ])('%p → %p', (v, ok) => expect(isPatientId(v)).toBe(ok));
});

describe('ageLabel', () => {
  it.each([
    ['1990-05-10', '2026-05-10', '36y'],
    ['1990-05-10', '2026-05-09', '35y'],
    ['2026-01-15', '2026-09-20', '8m'],
    ['2026-01-15', '2026-02-14', '0m'],
    ['2026-12-01', '2026-11-15', null],
    [null, '2026-11-15', null],
    ['not-a-date', '2026-11-15', null],
  ])('%p on %p → %p', (dob, today, out) => expect(ageLabel(dob, today)).toBe(out));
});

describe('patientSubtitle', () => {
  const p = { patientNumber: 'P-00034', dob: '1992-01-01', gender: 'male', bloodGroup: 'O+' } as const;
  it('joins the known parts', () => {
    expect(patientSubtitle(p, '2026-11-15')).toBe('P-00034 · 34y · Male · O+');
  });
  it('leaves out missing parts', () => {
    expect(patientSubtitle({ ...p, dob: null, gender: null, bloodGroup: null }, '2026-11-15')).toBe('P-00034');
  });
});

describe('contact links', () => {
  it('builds tel: with digits and a leading plus only', () => {
    expect(telUrl('+92 300-1234567')).toBe('tel:+923001234567');
    expect(telUrl('0300 1234567')).toBe('tel:03001234567');
    expect(telUrl('tel:evil;x')).toBeNull();
    expect(telUrl('0300;1234567')).toBe('tel:03001234567');
    expect(telUrl('---')).toBeNull();
    expect(telUrl(null)).toBeNull();
  });
  it('builds wa.me with digits only', () => {
    expect(whatsappUrl('+92 300-1234567')).toBe('https://wa.me/923001234567');
    expect(whatsappUrl('00923001234567')).toBe('https://wa.me/923001234567');
    expect(whatsappUrl('abc')).toBeNull();
    // national numbers get the clinic country code, international ones are untouched
    expect(whatsappUrl('0300-1234567', '92')).toBe('https://wa.me/923001234567');
    expect(whatsappUrl('+92 300 1234567', '92')).toBe('https://wa.me/923001234567');
    expect(whatsappUrl('0092 300 1234567', '92')).toBe('https://wa.me/923001234567');
    expect(whatsappUrl('0300-1234567')).toBe('https://wa.me/03001234567');
    expect(dialCodeForCurrency('pkr')).toBe('92');
    expect(dialCodeForCurrency('XXX')).toBeUndefined();
    expect(whatsappUrl(undefined)).toBeNull();
  });
});

describe('visibleSegments', () => {
  it('always has overview + visits', () => {
    expect(visibleSegments({ rx: 'denied', chart: 'denied' })).toEqual(['overview', 'visits']);
  });
  it('does not offer a segment while access is loading', () => {
    expect(visibleSegments({ rx: 'loading', chart: 'loading' })).toEqual(['overview', 'visits']);
  });
  it('adds rx and chart when allowed', () => {
    expect(visibleSegments({ rx: 'allowed', chart: 'allowed' })).toEqual(['overview', 'visits', 'rx', 'chart']);
    expect(visibleSegments({ rx: 'allowed', chart: 'denied' })).toEqual(['overview', 'visits', 'rx']);
  });
});

describe('vitals formatting', () => {
  it('tolerates numeric strings and skips missing values', () => {
    expect(fmtNum('36.60')).toBe('36.6');
    expect(fmtNum(null)).toBeNull();
    expect(fmtNum('abc')).toBeNull();
    const v = {
      bpSystolic: 120,
      bpDiastolic: 80,
      pulseRate: 72,
      temperature: '36.6',
      oxygenSaturation: null,
      weightKg: '70.00',
      heightCm: null,
      bmi: null,
    } as unknown as Vitals;
    expect(vitalsParts(v)).toEqual([
      { label: 'BP', value: '120/80 mmHg' },
      { label: 'Pulse', value: '72 bpm' },
      { label: 'Temp', value: '36.6 °C' },
      { label: 'Weight', value: '70 kg' },
    ]);
  });
});

describe('chartConditions', () => {
  it('reads the current model and the legacy forms, sorted by tooth', () => {
    const out = chartConditions({
      '18': { condition: 'MISSING' },
      '16': 'CARIES',
      '26': { surfaces: { O: { condition: 'FILLED' }, M: { condition: 'CARIES', planned: true } }, rootCanal: { planned: true } },
      '11': {},
      '12': { note: 'ignored without a finding' },
    });
    expect(out).toEqual([
      { tooth: '16', text: 'Caries' },
      { tooth: '18', text: 'Missing' },
      { tooth: '26', text: 'Root canal (planned), Filled O, Caries M (planned)' },
    ]);
  });
  it('is safe for empty data', () => {
    expect(chartConditions(null)).toEqual([]);
    expect(chartConditions({})).toEqual([]);
  });
});
