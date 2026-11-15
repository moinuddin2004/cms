import { CLAIM_TTL_MS, deadlineFromResponse, formatCountdown, secondsLeft } from './countdown';

describe('countdown', () => {
  it('ignores a wrong phone clock: uses server expiresAt minus server Date', () => {
    const receivedAt = 5_000_000; // phone clock is off by days — irrelevant
    const deadline = deadlineFromResponse(
      '2026-11-15T10:15:00Z',
      'Sun, 15 Nov 2026 10:00:00 GMT',
      receivedAt,
    );
    expect(deadline).toBe(receivedAt + CLAIM_TTL_MS);
    expect(secondsLeft(deadline, receivedAt)).toBe(900);
    expect(secondsLeft(deadline, receivedAt + 60_000)).toBe(840);
  });

  it('honours a shorter remaining time and caps at 15 minutes', () => {
    expect(deadlineFromResponse('2026-11-15T10:05:00Z', 'Sun, 15 Nov 2026 10:00:00 GMT', 0)).toBe(300_000);
    expect(deadlineFromResponse('2026-11-15T12:00:00Z', 'Sun, 15 Nov 2026 10:00:00 GMT', 0)).toBe(CLAIM_TTL_MS);
  });

  it('falls back to the full lifetime without a usable header', () => {
    expect(deadlineFromResponse('2026-11-15T10:15:00Z', undefined, 100)).toBe(100 + CLAIM_TTL_MS);
    expect(deadlineFromResponse('garbage', 'garbage', 100)).toBe(100 + CLAIM_TTL_MS);
  });

  it('never goes negative and formats m:ss', () => {
    expect(secondsLeft(1000, 5000)).toBe(0);
    expect(formatCountdown(900)).toBe('15:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(-3)).toBe('0:00');
  });
});
