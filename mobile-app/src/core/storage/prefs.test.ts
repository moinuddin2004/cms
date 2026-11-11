import { getPref, removePref, setPref } from './prefs';

// The Jest runner is card M0-06; until it (and @types/jest) lands, read the
// globals from `globalThis` so `tsc --noEmit` stays green.
const { describe, it, expect } = globalThis as unknown as {
  describe: (name: string, fn: () => void) => void;
  it: (name: string, fn: () => void) => void;
  expect: (actual: unknown) => {
    toBe: (expected: unknown) => void;
    toBeUndefined: () => void;
  };
};

describe('prefs', () => {
  it('round-trips a value', () => {
    setPref('staff.queue.segment', 'board');

    expect(getPref('staff.queue.segment')).toBe('board');
  });

  it('removes a value', () => {
    setPref('staff.queue.segment', 'doctor');
    removePref('staff.queue.segment');

    expect(getPref('staff.queue.segment')).toBeUndefined();
  });

  it('rejects unknown keys at the type level', () => {
    // @ts-expect-error `PrefKey` is the allow-list from docs/03 §2.6.
    getPref('staff.not-a-real-pref');
  });
});
