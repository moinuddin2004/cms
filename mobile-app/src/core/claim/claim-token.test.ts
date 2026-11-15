import { buildClaimLink, isClaimToken, parseClaimParam } from './claim-token';
import { usePendingClaimStore } from './usePendingClaimStore';

jest.mock('expo-linking', () => ({ createURL: (p: string) => `clinicapp-dev://${p}` }));

const TOKEN = 'a'.repeat(43);

describe('claim token', () => {
  it('accepts a 43-char base64url token only', () => {
    expect(isClaimToken(TOKEN)).toBe(true);
    expect(isClaimToken('short')).toBe(false);
    expect(isClaimToken(`${TOKEN}!`)).toBe(false);
    expect(isClaimToken(undefined)).toBe(false);
  });

  it('reads the first value of an array param', () => {
    expect(parseClaimParam([TOKEN, 'x'])).toBe(TOKEN);
    expect(parseClaimParam('nope')).toBeNull();
  });

  it('builds the deep link', () => {
    expect(buildClaimLink(TOKEN)).toBe(`clinicapp-dev://claim/${TOKEN}`);
  });

  it('holds and clears the pending token', () => {
    usePendingClaimStore.getState().set(TOKEN);
    expect(usePendingClaimStore.getState().token).toBe(TOKEN);
    usePendingClaimStore.getState().clear();
    expect(usePendingClaimStore.getState().token).toBeNull();
  });
});
