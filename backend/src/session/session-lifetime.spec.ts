import {
  DAY_MS,
  REMEMBERED_SESSION_MS,
  SHORT_SESSION_MS,
  remainingLifetimeMs,
  sessionExpiryFrom,
  sessionLifetimeMs,
} from './session-lifetime';

const now = new Date('2026-10-27T10:00:00.000Z');

describe('session lifetimes', () => {
  it('lasts one day when "keep me signed in" is not checked', () => {
    expect(sessionLifetimeMs(false)).toBe(DAY_MS);
    expect(SHORT_SESSION_MS).toBe(DAY_MS);
    expect(sessionExpiryFrom(now, false).toISOString()).toBe(
      '2026-10-28T10:00:00.000Z',
    );
  });

  it('lasts thirty days when "keep me signed in" is checked', () => {
    expect(sessionLifetimeMs(true)).toBe(30 * DAY_MS);
    expect(REMEMBERED_SESSION_MS).toBe(30 * DAY_MS);
    expect(sessionExpiryFrom(now, true).toISOString()).toBe(
      '2026-11-26T10:00:00.000Z',
    );
  });

  it('reports the remaining lifetime, never below zero', () => {
    expect(remainingLifetimeMs(new Date(now.getTime() + DAY_MS), now)).toBe(
      DAY_MS,
    );
    expect(
      remainingLifetimeMs(new Date(now.getTime() + 90 * 60 * 1000), now),
    ).toBe(90 * 60 * 1000);
    expect(remainingLifetimeMs(new Date(now.getTime() - 1), now)).toBe(0);
  });
});
