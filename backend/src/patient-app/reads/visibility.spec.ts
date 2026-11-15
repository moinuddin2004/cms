import {
  canSeeBilling,
  canSeeDiagnosis,
  clinicStatusFor,
  isPrescriptionVisible,
} from './visibility';

describe('patient visibility rules (07 §3)', () => {
  describe('prescriptions: finalized/amended AND signed', () => {
    const signed = new Date('2026-11-01T10:00:00Z');
    it.each([
      ['FINALIZED', signed, true],
      ['AMENDED', signed, true],
      ['DRAFT', signed, false],
      ['DRAFT', null, false],
      ['FINALIZED', null, false],
      ['AMENDED', null, false],
      ['finalized', signed, false], // enum values are upper-case; no fuzzy match
      ['', signed, false],
    ])('status %s signedAt %s → %s', (status, signedAt, expected) => {
      expect(isPrescriptionVisible({ status, signedAt })).toBe(expected);
    });
    it('treats undefined signedAt as unsigned', () => {
      expect(
        isPrescriptionVisible({ status: 'FINALIZED', signedAt: undefined }),
      ).toBe(false);
    });
  });

  describe('clinic status (A-19)', () => {
    it.each([
      ['approved', true, 'active'],
      ['approved', false, 'suspended'],
      ['pending', true, null],
      ['pending', false, null],
      ['rejected', true, null],
      ['rejected', false, null],
    ])(
      'approval %s, isActive %s → %s',
      (approvalStatus, isActive, expected) => {
        expect(clinicStatusFor({ approvalStatus, isActive })).toBe(expected);
      },
    );
  });

  describe('clinic settings', () => {
    it.each([
      [{ showBilling: true, showDiagnosis: true }, true, true],
      [{ showBilling: false, showDiagnosis: true }, false, true],
      [{ showBilling: true, showDiagnosis: false }, true, false],
      [{ showBilling: false, showDiagnosis: false }, false, false],
    ])('%j', (v, billing, diagnosis) => {
      expect(canSeeBilling(v)).toBe(billing);
      expect(canSeeDiagnosis(v)).toBe(diagnosis);
    });
  });
});
