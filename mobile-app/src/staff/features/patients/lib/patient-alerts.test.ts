import { patientAlerts, splitAllergies } from './patient-alerts';

const base = {
  allergies: null,
  isBlacklisted: false,
  blacklistReason: null,
  isMinor: false,
  guardianName: null,
  guardianRelation: null,
  guardianPhone: null,
};

describe('splitAllergies', () => {
  it.each([
    [null, []],
    [undefined, []],
    ['', []],
    [' , ,', []],
    ['Penicillin', ['Penicillin']],
    [' Penicillin ,Latex,, Nuts ', ['Penicillin', 'Latex', 'Nuts']],
  ])('splits %p', (input, expected) => {
    expect(splitAllergies(input)).toEqual(expected);
  });
});

describe('patientAlerts', () => {
  it('returns nothing for a clean patient', () => {
    expect(patientAlerts(base)).toEqual([]);
  });

  it('lists allergies joined by comma', () => {
    expect(patientAlerts({ ...base, allergies: 'Penicillin, Latex' })).toEqual([
      { kind: 'allergy', title: 'Allergies', text: 'Penicillin, Latex' },
    ]);
  });

  it.each([
    ['Missed 3 visits', 'Missed 3 visits'],
    [null, 'No reason given'],
    ['', 'No reason given'],
  ])('blacklisted with reason %p shows %p', (reason, text) => {
    expect(patientAlerts({ ...base, isBlacklisted: true, blacklistReason: reason })).toEqual([
      { kind: 'blacklist', title: 'Blacklisted', text },
    ]);
  });

  it.each([
    [{ guardianName: 'Ahmed', guardianRelation: 'Father', guardianPhone: '0300' }, 'Ahmed (Father) 0300'],
    [{ guardianName: 'Ahmed', guardianRelation: null, guardianPhone: null }, 'Ahmed'],
    [{ guardianName: null, guardianRelation: null, guardianPhone: '0300' }, '0300'],
    [{ guardianName: null, guardianRelation: null, guardianPhone: null }, 'Guardian not recorded'],
  ])('minor with guardian %p shows %p', (guardian, text) => {
    expect(patientAlerts({ ...base, isMinor: true, ...guardian })).toEqual([
      { kind: 'minor', title: 'Minor — guardian consent needed', text },
    ]);
  });

  it('keeps the order allergy → blacklist → minor', () => {
    const kinds = patientAlerts({
      ...base,
      allergies: 'Latex',
      isBlacklisted: true,
      isMinor: true,
    }).map((a) => a.kind);
    expect(kinds).toEqual(['allergy', 'blacklist', 'minor']);
  });
});
