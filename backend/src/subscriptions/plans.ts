import { SubscriptionPlan } from 'src/common/enums/subscription-plan.enum';

/** What a clinic's plan allows. `null` = unlimited. */
export interface PlanLimits {
  maxLocations: number | null;
  /** Logins in the clinic: owners + staff with portal access. */
  maxUsers: number | null;
}

export interface PlanDefinition extends PlanLimits {
  key: SubscriptionPlan;
  name: string;
  /** Monthly price in PKR; null = priced per clinic (talk to us). */
  monthlyPrice: number | null;
  description: string;
}

/**
 * The plan catalog. Payments are collected manually (bank transfer,
 * JazzCash, …) and recorded by a super admin, so prices here are what the
 * clinic sees — nothing charges them automatically.
 */
export const PLANS: Record<SubscriptionPlan, PlanDefinition> = {
  [SubscriptionPlan.FREE]: {
    key: SubscriptionPlan.FREE,
    name: 'Free',
    monthlyPrice: 0,
    maxLocations: 1,
    maxUsers: 2,
    description: 'One location and two logins.',
  },
  [SubscriptionPlan.STARTER]: {
    key: SubscriptionPlan.STARTER,
    name: 'Starter',
    monthlyPrice: 4999,
    maxLocations: 1,
    maxUsers: 5,
    description: 'A single clinic with a small team.',
  },
  [SubscriptionPlan.PROFESSIONAL]: {
    key: SubscriptionPlan.PROFESSIONAL,
    name: 'Professional',
    monthlyPrice: 9999,
    maxLocations: 3,
    maxUsers: 15,
    description: 'Up to three branches and a growing team.',
  },
  [SubscriptionPlan.ENTERPRISE]: {
    key: SubscriptionPlan.ENTERPRISE,
    name: 'Enterprise',
    monthlyPrice: null,
    maxLocations: null,
    maxUsers: null,
    description: 'Unlimited branches and staff, priced per clinic.',
  },
};

/** New self-signup clinics trial on this plan's limits. */
export const TRIAL_PLAN = SubscriptionPlan.PROFESSIONAL;
export const TRIAL_DAYS = 14;
/** Days after the paid/trial period ends before the clinic turns read-only. */
export const GRACE_DAYS = 3;
