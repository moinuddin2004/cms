/**
 * Which pieces of the demo clinic still need creating (M4-03). Pure, so the
 * "resume after a partial failure" paths are unit-tested without a database.
 */
export interface DemoSeedState {
  ownerExists: boolean;
  /** The demo organization row exists. */
  orgExists: boolean;
  /** `approval_status = 'approved'` (only meaningful when orgExists). */
  orgApproved: boolean;
  /** Subscription payment already recorded for the org. */
  paymentRecorded: boolean;
}

export interface DemoSeedPlan {
  createOwner: boolean;
  createClinic: boolean;
  approve: boolean;
  recordPayment: boolean;
}

export function planDemoClinic(s: DemoSeedState): DemoSeedPlan {
  return {
    createOwner: !s.ownerExists,
    createClinic: !s.orgExists,
    approve: !s.orgExists || !s.orgApproved,
    recordPayment: !s.orgExists || !s.paymentRecorded,
  };
}

/** A user row may exist (partial run) without its employee assignment. */
export function staffAction(s: {
  userExists: boolean;
  hasAssignment: boolean;
}): 'reuse' | 'create' {
  return s.userExists && s.hasAssignment ? 'reuse' : 'create';
}
