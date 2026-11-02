import type {
  FormDefinition,
  Promotions,
  ToothAnswer,
} from 'src/engine/forms/form-definition.types';
import { PROMOTION_TARGETS } from 'src/engine/forms/promotion-targets';
import { fdiDentition } from 'src/engine/forms/tooth-codes';
import { addDays } from 'src/common/clock/tz.util';
import { UnitType } from 'src/lab-catalog/enums/catalog.enums';

/**
 * Pure order-line rules used at submit and by revisions (lab ERD §5a, §10).
 * Specialty-neutral: teeth come from any `tooth_chart` field, typed columns
 * from the form's `promotions` map — no `if (dental)` here.
 */

export interface ToothRow {
  numberingSystem: 'FDI';
  toothCode: string;
  dentition: string;
  toothRole: string | null;
  surfaces: string[];
}

/** `item_teeth` rows from every tooth chart answer (first answer per tooth wins). */
export function extractTeeth(
  def: FormDefinition,
  answers: Record<string, unknown>,
): ToothRow[] {
  const rows = new Map<string, ToothRow>();
  for (const field of def.fields) {
    if (field.type !== 'tooth_chart') continue;
    const value = answers[field.key];
    if (!Array.isArray(value)) continue;
    for (const t of value as ToothAnswer[]) {
      if (!t || typeof t.tooth !== 'string' || rows.has(t.tooth)) continue;
      rows.set(t.tooth, {
        numberingSystem: 'FDI',
        toothCode: t.tooth,
        dentition: fdiDentition(t.tooth) ?? 'permanent',
        toothRole: t.role ?? null,
        surfaces: t.surfaces ?? [],
      });
    }
  }
  return [...rows.values()];
}

/**
 * Promoted answers grouped by table: `{ dental_item_details: { shade: 'A2' } }`.
 * Only registered targets are copied; empty answers are skipped; numbers are
 * kept as numbers (numeric columns accept them).
 */
export function promotedColumns(
  promotions: Promotions | null | undefined,
  answers: Record<string, unknown>,
): Record<string, Record<string, string | number>> {
  const out: Record<string, Record<string, string | number>> = {};
  for (const [key, target] of Object.entries(promotions ?? {})) {
    if (!PROMOTION_TARGETS[target]) continue;
    const value = answers[key];
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (typeof value !== 'string' && typeof value !== 'number')
    ) {
      continue;
    }
    const [table, column] = target.split('.');
    (out[table] ??= {})[column] = value;
  }
  return out;
}

/** Attachment ids referenced by `file` answers. */
export function fileAnswerIds(
  def: FormDefinition,
  answers: Record<string, unknown>,
): string[] {
  return def.fields
    .filter((f) => f.type === 'file')
    .flatMap((f) => {
      const v = answers[f.key];
      return Array.isArray(v) ? (v as string[]) : [];
    });
}

/**
 * Billable quantity. A per-tooth service counts its teeth (lab ERD §5b
 * "quantity = item_teeth count"); everything else keeps what was entered.
 */
export function lineQuantity(
  unitType: UnitType,
  entered: number,
  teeth: number,
): { quantity: number; issue: string | null } {
  if (unitType !== UnitType.PER_TOOTH) {
    return { quantity: entered, issue: null };
  }
  if (!teeth) {
    return {
      quantity: entered,
      issue: 'Mark the teeth: this service is priced per tooth',
    };
  }
  return { quantity: teeth, issue: null };
}

/** Integer minor units line total. */
export const lineTotal = (unitMinor: number, quantity: number): number =>
  unitMinor * quantity;

/**
 * When the work should come back: the clinic's requested day if any, else
 * submit day + the longest turnaround of the lines.
 */
export function estimateExpectedOn(
  submittedOn: string,
  turnaroundDays: number[],
  requestedOn: string | null,
): string {
  if (requestedOn) return requestedOn;
  return addDays(submittedOn, Math.max(0, ...turnaroundDays));
}

export interface OrderWarning {
  code: 'LAB_DUE_AFTER_NEXT_APPOINTMENT';
  message: string;
  appointmentId: string;
  appointmentOn: string;
  labExpectedOn: string;
}

/**
 * Lab ERD §14.3: warn when the work is due back after the patient's next
 * appointment, so the patient doesn't come in for nothing.
 */
export function appointmentWarning(
  labExpectedOn: string | null,
  next: { id: string; on: string } | null,
): OrderWarning | null {
  if (!labExpectedOn || !next || labExpectedOn <= next.on) return null;
  return {
    code: 'LAB_DUE_AFTER_NEXT_APPOINTMENT',
    message: `The lab work is due ${labExpectedOn}, after the patient's next appointment on ${next.on}`,
    appointmentId: next.id,
    appointmentOn: next.on,
    labExpectedOn,
  };
}
