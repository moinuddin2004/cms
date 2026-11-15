import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';

import { t } from '@/core/i18n';
import { signOutPatient } from '@/patient/features/auth';

import { deleteAccount } from '../api/account.api';

/**
 * Delete the account, then wipe this phone exactly like a sign-out (token,
 * encrypted patient cache and key, query cache) and leave the space. The
 * sign-out's own server logout fails harmlessly: the session is already gone.
 * If the delete itself fails nothing local is touched.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, void>({
    mutationFn: async () => {
      await deleteAccount();
      await signOutPatient(queryClient);
    },
    onError: () => toast.error(t('account.delete.failed')),
  });
}
