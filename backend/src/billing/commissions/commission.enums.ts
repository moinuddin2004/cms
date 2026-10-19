/** How an assignment (employee × location) is paid. */
export enum CompensationPlanType {
  SALARY = 'SALARY',
  COMMISSION = 'COMMISSION',
  SALARY_PLUS_COMMISSION = 'SALARY_PLUS_COMMISSION',
}

/**
 * What a commission rate applies to.
 * NET   — what the patient owes after discount (doctor shares the discount).
 * GROSS — the price before discount (the clinic absorbs the discount).
 */
export enum CommissionBasis {
  NET = 'NET',
  GROSS = 'GROSS',
}

/** Why a commission entry was written. */
export enum CommissionSourceType {
  /** Patient money allocated to the charge (collect / apply advance). */
  ALLOCATION = 'ALLOCATION',
  /** Money released from the charge back to advance (payment unapply). */
  UNAPPLY = 'UNAPPLY',
  /** The charge's net changed after money was collected (invoice edit). */
  CHARGE_ADJUST = 'CHARGE_ADJUST',
  /** The charge was voided after money was collected. */
  VOID = 'VOID',
  /** Reserved for an admin correction. */
  MANUAL = 'MANUAL',
}

export enum CommissionSettlementStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

export const COMMISSIONS_FEATURE = 'billing.commissions';

/** 100.00% in basis points. */
export const MAX_RATE_BPS = 10_000;
