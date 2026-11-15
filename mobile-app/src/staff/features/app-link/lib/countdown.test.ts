import { formatCountdown, secondsLeft } from './countdown';

describe('countdown', () => {
  const now = Date.parse('2026-11-15T10:00:00Z');

  it('counts whole seconds and never goes negative', () => {
    expect(secondsLeft('2026-11-15T10:15:00Z', now)).toBe(900);
    expect(secondsLeft('2026-11-15T10:00:00.400Z', now)).toBe(1);
    expect(secondsLeft('2026-11-15T09:00:00Z', now)).toBe(0);
    expect(secondsLeft('garbage', now)).toBe(0);
  });

  it('formats m:ss', () => {
    expect(formatCountdown(900)).toBe('15:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(-3)).toBe('0:00');
  });
});
