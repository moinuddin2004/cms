import { SubscriptionPlan } from 'src/common/enums/subscription-plan.enum';
import { GRACE_DAYS, PLANS, PlanLimits } from './plans';

const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionStatus =
  /** No trial and never paid: legacy clinic, no expiry, no plan limits. */
  | 'unmanaged'
  | 'trialing'
  | 'active'
  /** Period ended less than GRACE_DAYS ago — still writable, warned. */
  | 'grace'
  /** Read-only until a payment is recorded. */
  | 'expired';

export interface SubscriptionFields {
  subscriptionPlan: SubscriptionPlan;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
  maxLocations: number | null;
  maxUsers: number | null;
}

export interface SubscriptionState {
  status: SubscriptionStatus;
  /** When the trial / paid period ends (null for unmanaged). */
  periodEndsAt: Date | null;
  /** When the clinic turns read-only (period end + grace). */
  readOnlyFrom: Date | null;
  /** Whole days until `periodEndsAt` (negative once it has passed). */
  daysLeft: number | null;
  readOnly: boolean;
}

const later = (a: Date | null, b: Date | null) =>
  !a ? b : !b ? a : a > b ? a : b;

/** Where a clinic's subscription stands at `now`. Pure — see the spec. */
export function subscriptionState(
  org: Pick<SubscriptionFields, 'trialEndsAt' | 'paidUntil'>,
  now: Date,
): SubscriptionState {
  const { trialEndsAt, paidUntil } = org;
  if (!trialEndsAt && !paidUntil) {
    return {
      status: 'unmanaged',
      periodEndsAt: null,
      readOnlyFrom: null,
      daysLeft: null,
      readOnly: false,
    };
  }
  const periodEndsAt = later(trialEndsAt, paidUntil)!;
  const readOnlyFrom = new Date(periodEndsAt.getTime() + GRACE_DAYS * DAY_MS);
  const daysLeft = Math.ceil((periodEndsAt.getTime() - now.getTime()) / DAY_MS);

  let status: SubscriptionStatus;
  if (paidUntil && paidUntil > now) status = 'active';
  else if (trialEndsAt && trialEndsAt > now) status = 'trialing';
  else if (now < readOnlyFrom) status = 'grace';
  else status = 'expired';

  return {
    status,
    periodEndsAt,
    readOnlyFrom,
    daysLeft,
    readOnly: status === 'expired',
  };
}

/**
 * Limits in force: the org's own override wins, then the plan's. Unmanaged
 * clinics have none (they predate plans).
 */
export function effectiveLimits(org: SubscriptionFields): PlanLimits {
  const managed = !!(org.trialEndsAt || org.paidUntil);
  const plan = managed ? PLANS[org.subscriptionPlan] : null;
  return {
    maxLocations: org.maxLocations ?? plan?.maxLocations ?? null,
    maxUsers: org.maxUsers ?? plan?.maxUsers ?? null,
  };
}

/**
 * The new paid period for a payment covering `months`: it starts when the
 * current trial/paid period ends (or now, if that is already over), so
 * paying early never loses days.
 */
export function nextPaidPeriod(
  org: Pick<SubscriptionFields, 'trialEndsAt' | 'paidUntil'>,
  months: number,
  now: Date,
): { start: Date; end: Date } {
  const current = later(org.trialEndsAt, org.paidUntil);
  const start = current && current > now ? current : now;
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  return { start, end };
}
