import { useCallback, useEffect, useState } from 'react';

import { getGoogleIdToken, isNativeGoogleAvailable } from '@/core/auth/google';
import { env } from '@/core/env';
import { apiErrorMessage } from '@/core/http/api-error';
import { persistSession } from '@/staff/lib/api';

import { fetchGoogleConfig, googleSignIn, type GoogleSignInResult } from '../api/auth.api';
import { trackStaff } from '@/staff/lib/analytics';

export const GOOGLE_NO_ACCOUNT_MESSAGE =
  'No account found for this Google address. Register your clinic on the web, or ask your clinic owner for an invite link.';

/** What the sign-in screen says for outcomes that do not sign the user in. */
export function googleOutcomeMessage(result: GoogleSignInResult): string | null {
  if (result.outcome === 'no_account') return GOOGLE_NO_ACCOUNT_MESSAGE;
  if (result.outcome === 'link_required') return result.message;
  return null;
}

/**
 * "Continue with Google" for the staff sign-in screen. The button shows only when this build
 * has the native library AND the server says Google sign-in is on. A signed-in result is stored
 * like a password login; the root layout's guards then route to location selection. A clinic
 * Clinic sign-in policy (Google required / disabled / domain) is NOT answered here: it is
 * enforced at location selection via `signInBlock`. Any 403 from the call itself shows the
 * server's message.
 */
export function useGoogleSignIn() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isNativeGoogleAvailable()) return;
    let cancelled = false;
    fetchGoogleConfig()
      .then((config) => {
        if (!cancelled && config.enabled && config.clientId) setClientId(config.clientId);
      })
      .catch(() => {
        // Stay hidden: email sign-in still works, and the next visit asks again.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!clientId || pending) return;
    setError('');
    setPending(true);
    try {
      const idToken = await getGoogleIdToken(clientId, env.googleIosClientId);
      if (!idToken) return; // cancelled in the account picker
      const result = await googleSignIn(idToken);
      if (result.outcome === 'signed_in') {
        await persistSession(result.session);
        trackStaff('staff_signed_in', { method: 'google' });
        return;
      }
      setError(googleOutcomeMessage(result) ?? '');
    } catch (err) {
      setError(apiErrorMessage(err, 'Google sign-in failed. Please try again.'));
    } finally {
      setPending(false);
    }
  }, [clientId, pending]);

  return { available: clientId !== null, pending, error, signIn };
}
