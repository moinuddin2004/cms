import { useQuery } from '@tanstack/react-query';

import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { fetchTheme } from '../api/theme.api';

export const themeKeys = {
  all: ['theme'] as const,
  /** Org AND location are part of the key: both can change the resolved theme. */
  clinic: (orgId: string | null, locationId: string | null) =>
    ['theme', 'clinic', orgId, locationId] as const,
};

/**
 * The active clinic's theme. Reference data (docs/02 §6): a brand colour
 * changes rarely, and a pull-to-refresh still refetches regardless of
 * `staleTime`. Disabled without an org — the platform palette applies then.
 */
export function useClinicTheme() {
  const orgId = useStaffAuthStore((s) => s.activeOrganizationId);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);

  return useQuery({
    queryKey: themeKeys.clinic(orgId, locationId),
    queryFn: fetchTheme,
    enabled: !!orgId,
    staleTime: 10 * 60_000,
  });
}
