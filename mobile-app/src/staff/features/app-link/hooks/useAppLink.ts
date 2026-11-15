import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';

import { apiErrorMessage } from '@/core/http/api-error';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { createClaimToken, fetchAppLink, revokeAppLink } from '../api/app-link.api';
import { appLinkKeys } from '../api/app-link.keys';
import type { IssuedClaim } from '../types/app-link.types';

const POLL_MS = 5000;

function useTenantKey(patientId: string) {
  const orgId = useStaffAuthStore((s) => s.activeOrganizationId);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  return { orgId, locationId, ready: !!orgId && !!locationId && !!patientId };
}

/** Link status; refreshes every 5 s while the screen is open so "claimed" shows up on its own (docs/06 S-09). */
export function useAppLink(patientId: string) {
  const { orgId, locationId, ready } = useTenantKey(patientId);
  return useQuery({
    queryKey: appLinkKeys.status(orgId, locationId, patientId),
    queryFn: () => fetchAppLink(patientId),
    enabled: ready,
    refetchInterval: POLL_MS,
  });
}

/** Create a claim token. The result (a bearer secret) is handed to the caller only — never cached in the query client. */
export function useCreateClaimToken(patientId: string) {
  const queryClient = useQueryClient();
  const { orgId, locationId } = useTenantKey(patientId);
  return useMutation<IssuedClaim, unknown, void>({
    mutationFn: () => createClaimToken(patientId),
    gcTime: 0,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: appLinkKeys.status(orgId, locationId, patientId) }),
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not create the code.')),
  });
}

export function useRevokeAppLink(patientId: string) {
  const queryClient = useQueryClient();
  const { orgId, locationId } = useTenantKey(patientId);
  return useMutation<void, unknown, void>({
    mutationFn: () => revokeAppLink(patientId),
    onSuccess: () => {
      toast('App link removed');
      void queryClient.invalidateQueries({ queryKey: appLinkKeys.status(orgId, locationId, patientId) });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not remove the link.')),
  });
}
