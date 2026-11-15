import { useEffect, useState } from 'react';

import { hasSavedSession } from '@/core/space/switch-space';

/** Does the staff space have a saved session on this phone? (Checked once; used to offer "Switch to staff".) */
export function useStaffSessionAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let live = true;
    hasSavedSession('staff')
      .then((has) => {
        if (live) setAvailable(has);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return available;
}
