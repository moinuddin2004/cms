import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const MINUTE_MS = 60 * 1000;

/** "Now" as state: refreshed every minute and on return to the foreground, so Today rolls over at midnight. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return now;
}
