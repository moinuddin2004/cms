import { SubscriptionPlan } from 'src/common/enums/subscription-plan.enum';
import {
  effectiveLimits,
  nextPaidPeriod,
  subscriptionState,
} from './subscription-state';

const now = new Date('2026-10-24T10:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

describe('subscriptionState', () => {
  it('treats a clinic with no trial and no payment as unmanaged', () => {
    const s = subscriptionState({ trialEndsAt: null, paidUntil: null }, now);
    expect(s).toMatchObject({ status: 'unmanaged', readOnly: false });
    expect(s.daysLeft).toBeNull();
  });

  it('is trialing until the trial ends', () => {
    const s = subscriptionState({ trialEndsAt: days(5), paidUntil: null }, now);
    expect(s).toMatchObject({ status: 'trialing', daysLeft: 5, readOnly: false });
  });

  it('gives a grace period after the trial, then turns read-only', () => {
    expect(
      subscriptionState({ trialEndsAt: days(-1), paidUntil: null }, now),
    ).toMatchObject({ status: 'grace', readOnly: false });
    expect(
      subscriptionState({ trialEndsAt: days(-4), paidUntil: null }, now),
    ).toMatchObject({ status: 'expired', readOnly: true });
  });

  it('is active while paid, even if paid during the trial', () => {
    const s = subscriptionState(
      { trialEndsAt: days(3), paidUntil: days(33) },
      now,
    );
    expect(s).toMatchObject({ status: 'active', daysLeft: 33 });
  });

  it('expires a lapsed payment after the grace period', () => {
    expect(
      subscriptionState({ trialEndsAt: days(-60), paidUntil: days(-10) }, now),
    ).toMatchObject({ status: 'expired', readOnly: true });
  });
});

describe('effectiveLimits', () => {
  const base = {
    subscriptionPlan: SubscriptionPlan.STARTER,
    trialEndsAt: null,
    paidUntil: null,
    maxLocations: null,
    maxUsers: null,
  };

  it('has no limits for unmanaged clinics', () => {
    expect(effectiveLimits(base)).toEqual({
      maxLocations: null,
      maxUsers: null,
    });
  });

  it("uses the plan's limits once managed", () => {
    expect(effectiveLimits({ ...base, paidUntil: days(10) })).toEqual({
      maxLocations: 1,
      maxUsers: 5,
    });
  });

  it("lets the org's own override win", () => {
    expect(
      effectiveLimits({ ...base, paidUntil: days(10), maxUsers: 9 }),
    ).toEqual({ maxLocations: 1, maxUsers: 9 });
    expect(effectiveLimits({ ...base, maxLocations: 2 })).toEqual({
      maxLocations: 2,
      maxUsers: null,
    });
  });
});

describe('nextPaidPeriod', () => {
  it('starts after the running trial so no days are lost', () => {
    const p = nextPaidPeriod({ trialEndsAt: days(4), paidUntil: null }, 1, now);
    expect(p.start).toEqual(days(4));
    expect(p.end.getUTCMonth()).toBe((days(4).getUTCMonth() + 1) % 12);
  });

  it('starts now when the period already ended', () => {
    const p = nextPaidPeriod({ trialEndsAt: days(-20), paidUntil: null }, 3, now);
    expect(p.start).toEqual(now);
  });
});
