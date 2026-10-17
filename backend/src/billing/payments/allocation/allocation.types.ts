import { AllocationMode } from '../../enums/billing.enums';
import { Paisa } from '../../common/money';

/** Shared types of the allocation planner and its strategies. Pure. */

export const NEW_PAYMENT = 'NEW' as const;
/** `NEW_PAYMENT` or the id of a payment holding advance. */
export type FundSourceId = string;

export interface PlannerCharge {
  id: string;
  chargeDate: string;
  /** Epoch ms — FIFO tie-breaker. */
  createdAt: number;
  balancePaisa: Paisa;
}

export interface FundSource {
  source: FundSourceId;
  availablePaisa: Paisa;
}

export interface AllocationInput {
  charges: readonly PlannerCharge[];
  funds: readonly FundSource[];
  /** MANUAL mode: chargeId → requested paisa. */
  requested?: ReadonlyMap<string, Paisa>;
}

export interface PlannedLine {
  chargeId: string;
  source: FundSourceId;
  amountPaisa: Paisa;
}

export interface AllocationPlan {
  lines: PlannedLine[];
  /** chargeId → total paisa it receives. */
  perCharge: Map<string, Paisa>;
  /** Paisa taken from old advance. */
  advanceUsedPaisa: Paisa;
  /** Unallocated part of the new payment — becomes advance (D6). */
  newPaymentAdvancePaisa: Paisa;
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
    totalFundsPaisa: Paisa,
    input: AllocationInput,
  ): Map<string, Paisa>;
}
