import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner-native';

import { t } from '@/core/i18n';

import { confirmAppointment } from '../api/records.api';

/**
 * Confirm an upcoming appointment (M3-08). The server call is idempotent, so a
 * double tap or retry is harmless. Both appointment lists refresh afterwards
 * (full list + the cached upcoming one); a 409 means it is past or cancelled.
 */
export function useConfirmAppointment() {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith('records-appointments'),
    });
  return useMutation({
    mutationFn: confirmAppointment,
    onSuccess: async () => {
      await refresh();
    },
    onError: async (err) => {
      const gone = isAxiosError(err) && err.response?.status === 409;
      toast.error(t(gone ? 'records.appointment.confirmGone' : 'records.appointment.confirmFailed'));
      if (gone) await refresh();
    },
  });
}
