import { createSecureItem } from '@/core/storage/secure-store';

import { REFRESH_TOKEN_KEYS } from './session-keys';
import { useSpaceStore, type Space } from './useSpaceStore';

/**
 * Move between spaces without signing out of either (docs/02 §4): the root
 * guards react to `activeSpace`, the previous space's layout unmounts and its
 * session stays in memory + SecureStore.
 *
 * `null` goes back to the welcome picker (e.g. signing out of the last space).
 */
export function switchSpace(target: Space | null): void {
  useSpaceStore.getState().setActiveSpace(target);
}

export function otherSpace(space: Space): Space {
  return space === 'staff' ? 'patient' : 'staff';
}

/** Does this space have a saved session on the device (a refresh token in SecureStore)? */
export async function hasSavedSession(space: Space): Promise<boolean> {
  return (await createSecureItem(REFRESH_TOKEN_KEYS[space]).get()) !== null;
}

/**
 * After signing out of `current` (docs/02 §4): go to the other space when it
 * still has a saved session, else back to the welcome picker. Never touches
 * the other space's data. Call it AFTER the sign-out wipe finished, so the
 * outgoing space's token is already gone.
 */
export async function leaveSpaceAfterSignOut(current: Space): Promise<void> {
  const other = otherSpace(current);
  let target: Space | null = null;
  try {
    if (await hasSavedSession(other)) target = other;
  } catch {
    // keychain unreadable → welcome picker
  }
  switchSpace(target);
}
