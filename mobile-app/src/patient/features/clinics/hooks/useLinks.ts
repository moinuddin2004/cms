import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';

import { t } from '@/core/i18n';

import { fetchLinkHistory, fetchLinks, unlinkClinic } from '../api/clinics.api';
import { linkKeys } from '../api/clinics.keys';

/** All of the account's clinic links, live and revoked. */
export function useLinks() {
  return useQuery({ queryKey: linkKeys.list(), queryFn: fetchLinks });
}

/** Link history, fetched only once the user opens it. */
export function useLinkHistory(linkId: string, enabled: boolean) {
  return useQuery({
    queryKey: linkKeys.history(linkId),
    queryFn: () => fetchLinkHistory(linkId),
    enabled,
  });
}

/**
 * Unlink a clinic. Everything the patient cache holds may include that
 * clinic's records (visits, prescriptions, bills, profiles' links), so after a
 * success the whole patient cache is refreshed, not just the links.
 */
export function useUnlinkClinic() {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: unlinkClinic,
    onSuccess: async () => {
      toast.success(t('clinics.unlinked'));
      await queryClient.invalidateQueries();
    },
    onError: () => toast.error(t('clinics.unlinkFailed')),
  });
}
