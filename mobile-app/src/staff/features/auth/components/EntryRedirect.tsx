import { Redirect } from 'expo-router';

import { activeClinicBlock, needsLocationSelection, useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

/**
 * The "/" screen: sends the user to the right place. Needed because "/" only
 * exists inside route groups that are switched off for the current session.
 */
export function EntryRedirect() {
  const status = useStaffAuthStore((s) => s.status);
  const mustSelect = useStaffAuthStore((s) => needsLocationSelection(s) || activeClinicBlock(s) !== null);

  if (status === 'unreachable') return <Redirect href="/offline" />;
  if (status !== 'signedIn') return <Redirect href="/login" />;
  if (mustSelect) return <Redirect href="/select-location" />;
  return <Redirect href="/home" />;
}
