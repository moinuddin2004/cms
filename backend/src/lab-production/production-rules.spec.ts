import { ResponsibleParty } from './enums/production.enums';
import { remakeCharges } from './services/clinic-production.service';
import {
  addMonths,
  warrantyEndsOn,
} from './workflow/production-workflow.service';

describe('remake pricing (lab ERD §10 "Remake decision")', () => {
  const original = {
    labLineCostPaisa: 800_000,
    patientLinePricePaisa: 2_500_000,
  };

  it('lab fault → lab cost and patient price both 0', () => {
    expect(remakeCharges(ResponsibleParty.LAB, original)).toEqual({
      labPaisa: 0,
      patientPaisa: 0,
    });
  });

  it('clinic fault → the clinic pays the lab, the patient pays nothing', () => {
    expect(remakeCharges(ResponsibleParty.CLINIC, original)).toEqual({
      labPaisa: 800_000,
      patientPaisa: 0,
    });
  });

  it('patient fault → both charged as originally priced', () => {
    expect(remakeCharges(ResponsibleParty.PATIENT, original)).toEqual({
      labPaisa: 800_000,
      patientPaisa: 2_500_000,
    });
  });

  it('undetermined can’t be agreed', () => {
    expect(() =>
      remakeCharges(ResponsibleParty.UNDETERMINED, original),
    ).toThrow(/responsible/);
  });
});

describe('warranty dates', () => {
  it('adds months, clamping to the month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-10-20', 12)).toBe('2027-10-20');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('a 12-month warranty ends the day before the anniversary', () => {
    expect(warrantyEndsOn('2026-10-20', 12)).toBe('2027-10-19');
    expect(warrantyEndsOn('2026-03-01', 1)).toBe('2026-03-31');
  });
});
