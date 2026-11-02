import { CatalogException } from '../common/catalog-errors';
import { LabPriceSource } from '../enums/catalog.enums';
import {
  checkWindowEdit,
  isActiveOn,
  labUnitCost,
  pickLabPrice,
  pickPatientPrice,
  planNewWindow,
  PriceWindow,
} from './price-resolver';

const ORG = 'org-a';
const OTHER = 'org-b';

let seq = 0;
const w = (p: Partial<PriceWindow>): PriceWindow => ({
  id: `p${++seq}`,
  organizationId: null,
  unitPriceMinor: 500_000,
  rushSurchargeMinor: 0,
  currency: 'PKR',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  voidedAt: null,
  ...p,
});

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return e instanceof CatalogException ? e.code : 'other';
  }
  return undefined;
};

describe('isActiveOn', () => {
  it('includes both ends of the window', () => {
    const p = w({ effectiveFrom: '2026-03-01', effectiveTo: '2026-03-31' });
    expect(isActiveOn(p, '2026-02-28')).toBe(false);
    expect(isActiveOn(p, '2026-03-01')).toBe(true);
    expect(isActiveOn(p, '2026-03-31')).toBe(true);
    expect(isActiveOn(p, '2026-04-01')).toBe(false);
  });

  it('an open-ended window runs forever; a voided one never', () => {
    expect(isActiveOn(w({}), '2099-12-31')).toBe(true);
    expect(isActiveOn(w({ voidedAt: new Date() }), '2026-06-01')).toBe(false);
  });
});

describe('pickLabPrice', () => {
  const list = w({ unitPriceMinor: 800_000 });
  const negotiated = w({
    organizationId: ORG,
    unitPriceMinor: 650_000,
    effectiveFrom: '2026-05-01',
    effectiveTo: '2026-12-31',
  });
  const otherClinic = w({ organizationId: OTHER, unitPriceMinor: 100 });

  it("the clinic's negotiated price beats the lab list price", () => {
    const picked = pickLabPrice(
      [list, negotiated, otherClinic],
      ORG,
      '2026-06-15',
    );
    expect(picked?.price.id).toBe(negotiated.id);
    expect(picked?.source).toBe(LabPriceSource.NEGOTIATED);
  });

  it('falls back to the list price outside the negotiated window', () => {
    const before = pickLabPrice([list, negotiated], ORG, '2026-04-30');
    const after = pickLabPrice([list, negotiated], ORG, '2027-01-01');
    expect(before?.price.id).toBe(list.id);
    expect(before?.source).toBe(LabPriceSource.LIST);
    expect(after?.price.id).toBe(list.id);
  });

  it("never uses another clinic's negotiated price", () => {
    const picked = pickLabPrice([otherClinic], ORG, '2026-06-15');
    expect(picked).toBeNull();
    expect(pickLabPrice([list, otherClinic], ORG, '2026-06-15')?.price.id).toBe(
      list.id,
    );
  });

  it('ignores voided prices and returns null when the lab has no price that day', () => {
    const voided = w({ organizationId: ORG, voidedAt: new Date() });
    expect(pickLabPrice([voided], ORG, '2026-06-15')).toBeNull();
    const future = w({ effectiveFrom: '2027-01-01' });
    expect(pickLabPrice([future], ORG, '2026-06-15')).toBeNull();
  });

  it('a price change on a date: old price up to the day before, new from that day', () => {
    const old = w({ unitPriceMinor: 500_000, effectiveTo: '2026-06-30' });
    const next = w({ unitPriceMinor: 550_000, effectiveFrom: '2026-07-01' });
    expect(
      pickLabPrice([old, next], ORG, '2026-06-30')?.price.unitPriceMinor,
    ).toBe(500_000);
    expect(
      pickLabPrice([old, next], ORG, '2026-07-01')?.price.unitPriceMinor,
    ).toBe(550_000);
  });
});

describe('labUnitCost', () => {
  const price = { unitPriceMinor: 650_000, rushSurchargeMinor: 150_000 };
  const options = [
    { id: 'o1', extraCostMinor: 120_000 },
    { id: 'o2', extraCostMinor: 30_050 },
  ];

  it('adds options and, only when rushed, the rush surcharge — in integer minor', () => {
    expect(labUnitCost(price, options, false)).toEqual({
      baseMinor: 650_000,
      optionsMinor: 150_050,
      rushMinor: 0,
      unitMinor: 800_050,
    });
    expect(labUnitCost(price, options, true).unitMinor).toBe(950_050);
    expect(labUnitCost(price, [], false).unitMinor).toBe(650_000);
  });

  it('stays an integer', () => {
    const cost = labUnitCost(
      { unitPriceMinor: 1, rushSurchargeMinor: 1 },
      [{ id: 'x', extraCostMinor: 1 }],
      true,
    );
    expect(Number.isInteger(cost.unitMinor)).toBe(true);
    expect(cost.unitMinor).toBe(3);
  });
});

describe('pickPatientPrice', () => {
  const overrides = [
    { locationId: 'L1', doctorId: null, priceMinor: 1_200_000 },
    { locationId: 'L1', doctorId: 'D1', priceMinor: 1_500_000 },
    { locationId: 'L2', doctorId: null, priceMinor: 900_000 },
  ];

  it('doctor at location → location → treatment default (same as billing)', () => {
    expect(pickPatientPrice(1_000_000, overrides, 'L1', 'D1')).toEqual({
      unitPriceMinor: 1_500_000,
      level: 'DOCTOR',
    });
    expect(pickPatientPrice(1_000_000, overrides, 'L1', 'D2')).toEqual({
      unitPriceMinor: 1_200_000,
      level: 'LOCATION',
    });
    expect(pickPatientPrice(1_000_000, overrides, 'L3', 'D1')).toEqual({
      unitPriceMinor: 1_000_000,
      level: 'DEFAULT',
    });
  });

  it("a doctor's price at another location does not apply", () => {
    expect(
      pickPatientPrice(1_000_000, overrides, 'L2', 'D1').unitPriceMinor,
    ).toBe(900_000);
  });

  it('no location → the treatment default', () => {
    expect(pickPatientPrice(1_000_000, overrides, null, 'D1').level).toBe(
      'DEFAULT',
    );
  });
});

describe('planNewWindow', () => {
  const today = '2026-10-19';

  it('refuses back-dated prices and inverted windows', () => {
    expect(
      codeOf(() =>
        planNewWindow(
          [],
          { effectiveFrom: '2026-10-18', effectiveTo: null },
          today,
        ),
      ),
    ).toBe('LAB_PRICE_INVALID');
    expect(
      codeOf(() =>
        planNewWindow(
          [],
          { effectiveFrom: '2026-11-10', effectiveTo: '2026-11-01' },
          today,
        ),
      ),
    ).toBe('LAB_PRICE_INVALID');
  });

  it('a new open-ended price ends the running open-ended one the day before', () => {
    const running = w({ effectiveFrom: '2026-01-01' });
    expect(
      planNewWindow(
        [running],
        { effectiveFrom: '2026-11-01', effectiveTo: null },
        today,
      ),
    ).toEqual({ close: { id: running.id, effectiveTo: '2026-10-31' } });
  });

  it('starting today closes the running price yesterday', () => {
    const running = w({ effectiveFrom: '2026-01-01' });
    expect(
      planNewWindow(
        [running],
        { effectiveFrom: today, effectiveTo: null },
        today,
      ).close?.effectiveTo,
    ).toBe('2026-10-18');
  });

  it('any other overlap is refused', () => {
    const fixed = w({ effectiveFrom: '2026-11-01', effectiveTo: '2026-11-30' });
    expect(
      codeOf(() =>
        planNewWindow(
          [fixed],
          { effectiveFrom: '2026-11-15', effectiveTo: null },
          today,
        ),
      ),
    ).toBe('LAB_PRICE_OVERLAP');
    const openFuture = w({ effectiveFrom: '2026-12-01' });
    expect(
      codeOf(() =>
        planNewWindow(
          [openFuture],
          { effectiveFrom: '2026-11-01', effectiveTo: null },
          today,
        ),
      ),
    ).toBe('LAB_PRICE_OVERLAP');
    // A bounded promo over a running open-ended price is not a supersede.
    const running = w({ effectiveFrom: '2026-01-01' });
    expect(
      codeOf(() =>
        planNewWindow(
          [running],
          { effectiveFrom: '2026-11-01', effectiveTo: '2026-11-30' },
          today,
        ),
      ),
    ).toBe('LAB_PRICE_OVERLAP');
  });

  it('adjacent and voided windows do not overlap', () => {
    const ended = w({ effectiveFrom: '2026-01-01', effectiveTo: '2026-10-31' });
    const voided = w({ effectiveFrom: '2026-11-01', voidedAt: new Date() });
    expect(
      planNewWindow(
        [ended, voided],
        { effectiveFrom: '2026-11-01', effectiveTo: null },
        today,
      ),
    ).toEqual({ close: null });
  });
});

describe('checkWindowEdit', () => {
  const today = '2026-10-19';

  it('a started price keeps its amounts and start date', () => {
    const started = w({ effectiveFrom: '2026-10-01' });
    expect(
      codeOf(() => checkWindowEdit(started, { amountsChanged: true }, today)),
    ).toBe('LAB_PRICE_LOCKED');
    expect(
      codeOf(() =>
        checkWindowEdit(
          started,
          { amountsChanged: false, effectiveFrom: '2026-10-05' },
          today,
        ),
      ),
    ).toBe('LAB_PRICE_LOCKED');
  });

  it('a started price can be ended yesterday at the earliest', () => {
    const started = w({ effectiveFrom: '2026-10-01' });
    expect(
      codeOf(() =>
        checkWindowEdit(
          started,
          { amountsChanged: false, effectiveTo: '2026-10-17' },
          today,
        ),
      ),
    ).toBe('LAB_PRICE_INVALID');
    expect(
      codeOf(() =>
        checkWindowEdit(
          started,
          { amountsChanged: false, effectiveTo: '2026-10-18' },
          today,
        ),
      ),
    ).toBeUndefined();
  });

  it('a future price is fully editable but not into the past', () => {
    const future = w({ effectiveFrom: '2026-11-01' });
    expect(
      codeOf(() =>
        checkWindowEdit(
          future,
          { amountsChanged: true, effectiveFrom: '2026-11-15' },
          today,
        ),
      ),
    ).toBeUndefined();
    expect(
      codeOf(() =>
        checkWindowEdit(
          future,
          { amountsChanged: false, effectiveFrom: '2026-10-01' },
          today,
        ),
      ),
    ).toBe('LAB_PRICE_INVALID');
  });

  it('voided prices are locked', () => {
    expect(
      codeOf(() =>
        checkWindowEdit(
          w({ effectiveFrom: '2026-11-01', voidedAt: new Date() }),
          { amountsChanged: false },
          today,
        ),
      ),
    ).toBe('LAB_PRICE_LOCKED');
  });
});
