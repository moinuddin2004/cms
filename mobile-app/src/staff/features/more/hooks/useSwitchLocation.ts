import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';

import { apiErrorMessage } from '@/core/http/api-error';
import { switchLocation } from '@/staff/features/auth';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { clearStaffCacheExceptAccess } from '../lib/clear-staff-cache';

interface Target {
  organizationId: string;
  locationId: string;
}

/**
 * Switch the open session to another clinic / location (docs/10 M1-02 step 3):
 * server first, then the cache is emptied (access refetches), then the store
 * moves — so nothing from the old place is shown under the new headers.
 */
export function useSwitchLocation() {
  const queryClient = useQueryClient();
  const setLocationContext = useStaffAuthStore((s) => s.setLocationContext);

  return useMutation({
    mutationFn: ({ organizationId, locationId }: Target) =>
      switchLocation(organizationId, locationId),
    onSuccess: async (result) => {
      await clearStaffCacheExceptAccess(queryClient);
      setLocationContext(result.activeOrganizationId, result.activeLocationId);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not switch location.')),
  });
}
