import { usePathname, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { log } from '@/core/log';

/**
 * Dev builds only (rendered behind `__DEV__` in `RootShell`): prints every route change to the
 * Metro terminal so a navigation loop shows which screens it bounces between. Stops after
 * 40 lines in one second, which is already a loop. Paths hold ids at most, never names.
 */
export function DevRouteTrace() {
  const pathname = usePathname();
  const segments = useSegments();
  const window = useRef({ start: 0, count: 0 });
  const route = `${pathname}  [${segments.join('/')}]`;

  useEffect(() => {
    const now = Date.now();
    const w = window.current;
    if (now - w.start > 1000) {
      w.start = now;
      w.count = 0;
    }
    w.count += 1;
    if (w.count <= 40) log.debug(`[route] ${route}`);
    else if (w.count === 41) log.warn('[route] more than 40 route changes in 1 s — navigation loop');
  }, [route]);

  return null;
}
