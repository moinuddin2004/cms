import { useEffect, useState } from 'react';

const TICK_MS = 60_000;

/**
 * "Now" for waiting-time labels: the snapshot's server `now`, advanced by the
 * phone's elapsed time once a minute so "12m" keeps counting between refetches.
 * Only the elapsed duration comes from the phone; the base is the server clock.
 */
export function useTickingNow(serverNow: string): string {
  const [state, setState] = useState({ server: serverNow, now: serverNow });
  // A new snapshot re-bases the clock (state derived during render, not in an effect).
  if (state.server !== serverNow) setState({ server: serverNow, now: serverNow });

  useEffect(() => {
    const base = Date.parse(serverNow);
    if (Number.isNaN(base)) return undefined;
    const startedAt = Date.now();
    const id = setInterval(() => {
      setState({ server: serverNow, now: new Date(base + (Date.now() - startedAt)).toISOString() });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [serverNow]);

  return state.server === serverNow ? state.now : serverNow;
}
