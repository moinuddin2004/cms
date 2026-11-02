import { AllocationMode } from '../../enums/billing.enums';
import { Minor } from '../../common/money';

/** Shared types of the allocation planner and its strategies. Pure. */

export const NEW_PAYMENT = 'NEW' as const;
/** `NEW_PAYMENT` or the id of a payment holding advance. */
export type FundSourceId = string;

export interface PlannerCharge {
  id: string;
  chargeDate: string;
  /** Epoch ms — FIFO tie-breaker. */
  createdAt: number;
  balanceMinor: Minor;
}

export interface FundSource {
  source: FundSourceId;
  availableMinor: Minor;
}

export interface AllocationInput {
  charges: readonly PlannerCharge[];
  funds: readonly FundSource[];
  /** MANUAL mode: chargeId → requested minor units. */
  requested?: ReadonlyMap<string, Minor>;
}

export interface PlannedLine {
  chargeId: string;
  source: FundSourceId;
  amountMinor: Minor;
}

export interface AllocationPlan {
  lines: PlannedLine[];
  /** chargeId → total minor units it receives. */
  perCharge: Map<string, Minor>;
  /** Minor taken from old advance. */
  advanceUsedMinor: Minor;
  /** Unallocated part of the new payment — becomes advance (D6). */
  newPaymentAdvanceMinor: Minor;
}

export type AllocationPlanErrorCode =
  | 'BILLING_ALLOCATION_EXCEEDS_BALANCE'
  | 'BILLING_ALLOCATION_EXCEEDS_FUNDS';

export class AllocationPlanError extends Error {
  constructor(
    readonly code: AllocationPlanErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Decides each charge's target amount given the total funds (Strategy). */
export interface AllocationStrategy {
  readonly mode: AllocationMode;
  targets(
    sortedCharges: readonly PlannerCharge[],
    totalFundsMinor: Minor,
    input: AllocationInput,
  ): Map<string, Minor>;
}
