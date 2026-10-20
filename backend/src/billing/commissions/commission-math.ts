/**
 * Commission arithmetic. Pure: no NestJS / TypeORM / DB. All money is
 * integer paisa, all rates integer basis points (4000 = 40.00%); products
 * are computed in BigInt so nothing ever touches floating point.
 */

import { ServiceKind } from '../enums/billing.enums';
import {
  CommissionBasis,
  CompensationPlanType,
  MAX_RATE_BPS,
} from './commission.enums';

export interface CommissionRuleLike {
  serviceId: string | null;
  serviceCategory: ServiceKind | null;
  rateBps: number | null;
  fixedAmountPaisa: number | null;
}

export interface CommissionPlanLike {
  type: CompensationPlanType;
  defaultRateBps: number | null;
  rules: readonly CommissionRuleLike[];
}

export interface ChargeServiceLike {
  serviceId: string | null;
  serviceKind: ServiceKind;
}

/** Exactly one of `rateBps` / `fixedPaisa` is set. */
export interface ResolvedCommission {
  rateBps: number | null;
  fixedPaisa: number | null;
  source: 'SERVICE' | 'CATEGORY' | 'DEFAULT';
}

/**
 * Same idea as price resolution: a rule for the exact service wins, then a
 * rule for the service's category, then the plan's default rate. A
 * salary-only plan earns no commission (null).
 */
export function resolveCommissionRate(
  plan: CommissionPlanLike,
  charge: ChargeServiceLike,
): ResolvedCommission | null {
  if (plan.type === CompensationPlanType.SALARY) return null;
  const pick = (
    r: CommissionRuleLike | undefined,
    source: ResolvedCommission['source'],
  ): ResolvedCommission | null =>
    r ? { rateBps: r.rateBps, fixedPaisa: r.fixedAmountPaisa, source } : null;

  const byService = charge.serviceId
    ? plan.rules.find((r) => r.serviceId === charge.serviceId)
    : undefined;
  const byCategory = plan.rules.find(
    (r) => r.serviceId === null && r.serviceCategory === charge.serviceKind,
  );
  return (
    pick(byService, 'SERVICE') ??
    pick(byCategory, 'CATEGORY') ??
    (plan.defaultRateBps === null
      ? null
      : { rateBps: plan.defaultRateBps, fixedPaisa: null, source: 'DEFAULT' })
  );
}

/** round(n / d) with halves away from zero, exact (d > 0). */
export function divRoundHalfUp(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new Error('divRoundHalfUp: divisor must be positive');
  if (n < 0n) return -divRoundHalfUp(-n, d);
  return (2n * n + d) / (2n * d);
}

export interface CommissionTargetInput {
  /** SUM of allocations on the charge (may exceed net only transiently). */
  allocatedPaisa: number;
  /** 0 for a VOID charge. */
  netPaisa: number;
  grossPaisa: number;
  basis: CommissionBasis;
  rateBps: number | null;
  fixedPaisa: number | null;
  /**
   * Lab cost of the case (lab ERD §6c basis `net_of_lab_cost`): the doctor
   * earns on the price minus what the lab charged, pro rata to what was
   * collected. Omitted / 0 for work without a lab.
   */
  labCostPaisa?: number;
}

export interface CommissionTarget {
  /** Collected on the charge, capped at net. */
  collectedPaisa: number;
  /** Total commission the charge should have earned so far. */
  targetPaisa: number;
}

/**
 * Cumulative commission target for what has been collected on a charge.
 *
 *   collected = min(allocated, net)
 *   net = 0                → 0
 *   rate, NET basis        → round(collected × rate / 10000)
 *   rate, GROSS basis      → round(collected × gross × rate / (net × 10000))
 *   fixed amount           → round(fixed × collected / net)
 *   with lab cost L        → rate on (net − L) or (gross − L) instead,
 *                            round(collected × max(base − L, 0) × rate / (net × 10000));
 *                            a fixed amount is not reduced
 *
 * Callers insert `target − already recorded`, so installments never drift,
 * unapply reverses itself and price / discount changes adjust automatically.
 */
export function commissionTarget(i: CommissionTargetInput): CommissionTarget {
  const net = BigInt(Math.max(0, i.netPaisa));
  const collected =
    net === 0n
      ? 0n
      : BigInt(Math.min(Math.max(0, i.allocatedPaisa), Number(net)));
  const result = (target: bigint): CommissionTarget => ({
    collectedPaisa: Number(collected),
    targetPaisa: Number(target),
  });
  if (net === 0n || collected === 0n) return result(0n);

  if (i.fixedPaisa !== null) {
    return result(divRoundHalfUp(BigInt(i.fixedPaisa) * collected, net));
  }
  const rate = BigInt(i.rateBps ?? 0);
  const scale = BigInt(MAX_RATE_BPS);
  const lab = BigInt(Math.max(0, i.labCostPaisa ?? 0));
  if (lab > 0n) {
    const price =
      i.basis === CommissionBasis.GROSS ? BigInt(i.grossPaisa) : net;
    const base = price > lab ? price - lab : 0n;
    return result(divRoundHalfUp(collected * base * rate, net * scale));
  }
  if (i.basis === CommissionBasis.GROSS) {
    return result(
      divRoundHalfUp(collected * BigInt(i.grossPaisa) * rate, net * scale),
    );
  }
  return result(divRoundHalfUp(collected * rate, scale));
}

// ─── exact text ↔ integer conversions (no floats) ─────────────────────

const DECIMAL = /^\s*(\d+)(?:\.(\d{0,2}))?\s*$/;

/** "40" → 4000, "12.5" → 1250, "0.05" → 5. Null when not a 0–100 % value. */
export function percentToBps(text: string | number): number | null {
  const m = DECIMAL.exec(String(text));
  if (!m) return null;
  const bps = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return bps <= MAX_RATE_BPS ? bps : null;
}

/** 4000 → "40", 1250 → "12.5", 5 → "0.05". */
export function bpsToPercent(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const frac = String(bps % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : String(whole);
}

/** Rupees (≤ 2 decimals) → paisa without float math. Null when invalid. */
export function rupeesToPaisa(value: string | number): number | null {
  const m = DECIMAL.exec(String(value));
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}
