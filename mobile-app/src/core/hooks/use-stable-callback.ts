import { useCallback, useEffect, useRef } from 'react';

/**
 * A function with a stable identity that always calls the latest `fn`. Lets a
 * list pass the same handler to every memoised row across renders (docs/09 §5).
 */
export function useStableCallback<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: Args) => ref.current(...args), []);
}
