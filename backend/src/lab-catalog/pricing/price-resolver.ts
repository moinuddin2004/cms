/**
 * Catalog price rules (lab ERD §4, §13 "Lab pricing", "Patient pricing",
 * "Price locking"). Pure: no NestJS / TypeORM, all money integer paisa.
 * Sprint 6 snapshots what these return onto the order item at submit, so
 * later catalog edits never change an existing order or invoice.
 */
import { addDays } from 'src/common/clock/tz.util';
import { catalogError } from '../common/catalog-errors';
import { LabPriceSource } from '../enums/catalog.enums';

/** "YYYY-MM-DD" calendar date. Plain string compare orders them correctly. */
export type Ymd = string;

export interface PriceWindow {
  id: string;
  organizationId: string | null;
  unitPricePaisa: number;
  rushSurchargePaisa: number;
  currency: string;
  effectiveFrom: Ymd;
  effectiveTo: Ymd | null;
  voidedAt: Date | null;
}

export interface PickedLabPrice<T extends PriceWindow = PriceWindow> {
  price: T;
  source: LabPriceSource;
}

/** Whether a (non-voided) window covers `on`. Both ends inclusive. */
export function isActiveOn(w: PriceWindow, on: Ymd): boolean {
  return (
    w.voidedAt === null &&
    w.effectiveFrom <= on &&
    (w.effectiveTo === null || w.effectiveTo >= on)
  );
}

/**
 * The lab price a clinic pays for a service on a date: the clinic's own
 * negotiated price active that day, else the lab's list price active that
 * day, else null (the lab has no price for that day). Windows of other
 * clinics are ignored, so a caller may pass every row of the service.
 */
export function pickLabPrice<T extends PriceWindow>(
  windows: readonly T[],
  organizationId: string,
  on: Ymd,
): PickedLabPrice<T> | null {
  const active = windows.filter((w) => isActiveOn(w, on));
  const negotiated = active.find((w) => w.organizationId === organizationId);
  if (negotiated) {
    return { price: negotiated, source: LabPriceSource.NEGOTIATED };
  }
  const list = active.find((w) => w.organizationId === null);
  return list ? { price: list, source: LabPriceSource.LIST } : null;
}

export interface OptionCost {
  id: string;
  extraCostPaisa: number;
}

export interface LabUnitCost {
  basePaisa: number;
  optionsPaisa: number;
  rushPaisa: number;
  /** base + options + rush: what one unit costs the clinic. */
  unitPaisa: number;
}

/** One unit's lab cost: the resolved price plus chosen options and rush. */
export function labUnitCost(
  price: Pick<PriceWindow, 'unitPricePaisa' | 'rushSurchargePaisa'>,
  options: readonly OptionCost[],
  rush: boolean,
): LabUnitCost {
  const optionsPaisa = options.reduce((sum, o) => sum + o.extraCostPaisa, 0);
  const rushPaisa = rush ? price.rushSurchargePaisa : 0;
  return {
    basePaisa: price.unitPricePaisa,
    optionsPaisa,
    rushPaisa,
    unitPaisa: price.unitPricePaisa + optionsPaisa + rushPaisa,
  };
}

export type PatientPriceLevel = 'DOCTOR' | 'LOCATION' | 'DEFAULT';

export interface PatientPriceOverride {
  locationId: string;
  doctorId: string | null;
  pricePaisa: number;
}

/**
 * The clinic's patient price for a treatment — the same precedence billing
 * charges with (doctor at location → location → treatment default), so a
 * lab order line and the charge billed for it agree.
 */
export function pickPatientPrice(
  defaultPaisa: number,
  overrides: readonly PatientPriceOverride[],
  locationId: string | null,
  doctorId: string | null,
): { unitPricePaisa: number; level: PatientPriceLevel } {
  const atLocation = locationId
    ? overrides.filter((o) => o.locationId === locationId)
    : [];
  const doctor = doctorId
    ? atLocation.find((o) => o.doctorId === doctorId)
    : undefined;
  if (doctor) return { unitPricePaisa: doctor.pricePaisa, level: 'DOCTOR' };
  const location = atLocation.find((o) => o.doctorId === null);
  if (location) {
    return { unitPricePaisa: location.pricePaisa, level: 'LOCATION' };
  }
  return { unitPricePaisa: defaultPaisa, level: 'DEFAULT' };
}

export interface NewWindow {
  effectiveFrom: Ymd;
  effectiveTo: Ymd | null;
}

/**
 * Checks a new price window against the existing (non-voided) windows of
 * the same (service, clinic) and decides what to close. Prices are never
 * back-dated (`effectiveFrom` ≥ today) so history stays what it was. An
 * open-ended new price supersedes the open-ended price running before it:
 * that one is ended the day before. Any other overlap is refused.
 */
export function planNewWindow(
  existing: readonly PriceWindow[],
  next: NewWindow,
  today: Ymd,
): { close: { id: string; effectiveTo: Ymd } | null } {
  if (next.effectiveFrom < today) {
    throw catalogError(
      'LAB_PRICE_INVALID',
      'A new price cannot start in the past',
    );
  }
  if (next.effectiveTo !== null && next.effectiveTo < next.effectiveFrom) {
    throw catalogError(
      'LAB_PRICE_INVALID',
      'The end date must be on or after the start date',
    );
  }
  let close: { id: string; effectiveTo: Ymd } | null = null;
  for (const w of existing) {
    if (w.voidedAt !== null || !overlaps(w, next)) continue;
    const supersedes =
      next.effectiveTo === null &&
      w.effectiveTo === null &&
      w.effectiveFrom < next.effectiveFrom;
    if (supersedes && !close) {
      close = { id: w.id, effectiveTo: addDays(next.effectiveFrom, -1) };
      continue;
    }
    throw catalogError(
      'LAB_PRICE_OVERLAP',
      `Another price is already set from ${w.effectiveFrom}${
        w.effectiveTo ? ` to ${w.effectiveTo}` : ''
      }`,
      { conflictingPriceId: w.id },
    );
  }
  return { close };
}

/**
 * What may still change on a price: a future price (not started yet) is
 * fully editable; a started one only gets an end date, never earlier than
 * yesterday — the days it was charged at stay as they were.
 */
export function checkWindowEdit(
  current: PriceWindow,
  edit: {
    amountsChanged: boolean;
    effectiveFrom?: Ymd;
    effectiveTo?: Ymd | null;
  },
  today: Ymd,
): void {
  if (current.voidedAt) {
    throw catalogError('LAB_PRICE_LOCKED', 'This price was voided');
  }
  const started = current.effectiveFrom <= today;
  if (started) {
    if (
      edit.amountsChanged ||
      (edit.effectiveFrom !== undefined &&
        edit.effectiveFrom !== current.effectiveFrom)
    ) {
      throw catalogError(
        'LAB_PRICE_LOCKED',
        'This price is already in use — end it and add a new price instead',
      );
    }
    if (
      edit.effectiveTo !== undefined &&
      edit.effectiveTo !== null &&
      edit.effectiveTo < addDays(today, -1)
    ) {
      throw catalogError(
        'LAB_PRICE_INVALID',
        'A price in use can end yesterday at the earliest',
      );
    }
  } else if (edit.effectiveFrom !== undefined && edit.effectiveFrom < today) {
    throw catalogError(
      'LAB_PRICE_INVALID',
      'A new price cannot start in the past',
    );
  }
  const from = edit.effectiveFrom ?? current.effectiveFrom;
  const to =
    edit.effectiveTo === undefined ? current.effectiveTo : edit.effectiveTo;
  if (to !== null && to < from) {
    throw catalogError(
      'LAB_PRICE_INVALID',
      'The end date must be on or after the start date',
    );
  }
}

function overlaps(w: PriceWindow, next: NewWindow): boolean {
  const startsBeforeNextEnds =
    next.effectiveTo === null || w.effectiveFrom <= next.effectiveTo;
  const endsAfterNextStarts =
    w.effectiveTo === null || w.effectiveTo >= next.effectiveFrom;
  return startsBeforeNextEnds && endsAfterNextStarts;
}
