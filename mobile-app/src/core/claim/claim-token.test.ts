import { isClaimToken, parseClaimParam } from './claim-token';
import { PENDING_CLAIM_MAX_AGE_MS, usePendingClaimStore } from './usePendingClaimStore';

const TOKEN = 'a'.repeat(43);

describe('claim token', () => {
  it('accepts exactly 43 base64url chars', () => {
    expect(isClaimToken(TOKEN)).toBe(true);
    expect(isClaimToken('a'.repeat(42))).toBe(false);
    expect(isClaimToken('a'.repeat(44))).toBe(false);
    expect(isClaimToken(`${'a'.repeat(42)}!`)).toBe(false);
    expect(isClaimToken(undefined)).toBe(false);
  });

  it('reads the first value of an array param', () => {
    expect(parseClaimParam([TOKEN, 'x'])).toBe(TOKEN);
    expect(parseClaimParam('nope')).toBeNull();
  });
});

describe('pending claim store', () => {
  afterEach(() => usePendingClaimStore.getState().clear());

  it('holds and clears the token', () => {
    usePendingClaimStore.getState().set(TOKEN);
    expect(usePendingClaimStore.getState().token).toBe(TOKEN);
    usePendingClaimStore.getState().clear();
    expect(usePendingClaimStore.getState().token).toBeNull();
  });

  it('keeps a fresh token and drops one older than 15 minutes', () => {
    const s = usePendingClaimStore.getState();
    s.set(TOKEN, 1_000);
    expect(s.dropIfStale(1_000 + PENDING_CLAIM_MAX_AGE_MS)).toBe(true);
    expect(usePendingClaimStore.getState().token).toBe(TOKEN);
    expect(s.dropIfStale(1_001 + PENDING_CLAIM_MAX_AGE_MS)).toBe(false);
    expect(usePendingClaimStore.getState().token).toBeNull();
  });
});
