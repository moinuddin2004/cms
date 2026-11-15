import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner-native';

import {
  isDialogError,
  queueErrorCode,
  queueErrorMessage,
  shouldRefetch,
  useCheckIn,
  useConvertToWalkIn,
} from '@/staff/features/queue';

import { appointmentKeys } from '../api/appointments.keys';

/**
 * Check-in from the schedule sheet (docs/06 S-03): `useCheckIn`; on
 * `LATE_LIMIT_EXCEEDED` the screen asks "Add as walk-in?" and `convert` runs
 * `useConvertToWalkIn`. Both are queue mutations (one Idempotency-Key per tap).
 * The queue hooks invalidate the queue keys; this adds `appointmentKeys.all`,
 * because the day list and the arrivals key (outside `list`) both change.
 */
export function useCheckInFlow(onDone: () => void) {
  const queryClient = useQueryClient();
  const checkIn = useCheckIn();
  const convertToWalkIn = useConvertToWalkIn();
  // The booking that was too late, with the urgent reason typed for it (kept for the convert).
  const [lateFor, setLateFor] = useState<{ id: string; urgentReason?: string } | null>(null);

  const refreshAppointments = () =>
    queryClient.invalidateQueries({ queryKey: appointmentKeys.all });

  const start = (appointmentId: string, urgentReason?: string) => {
    if (checkIn.isPending) return;
    checkIn.mutate(
      { appointmentId, urgentReason },
      {
        onSuccess: (result) => {
          void refreshAppointments();
          toast.success(`Patient checked in · Token ${result.token}`);
          onDone();
        },
        onError: (err) => {
          // Other errors were toasted by the queue hook; the dialog code is ours.
          if (queueErrorCode(err) === 'LATE_LIMIT_EXCEEDED') setLateFor({ id: appointmentId, urgentReason });
          else if (isDialogError(err)) toast.error(queueErrorMessage(err));
          else if (shouldRefetch(err)) void refreshAppointments();
        },
      },
    );
  };

  /** Rejects on failure so `ConfirmDialog` stays open for a retry. */
  const convert = async () => {
    if (!lateFor) return;
    try {
      const result = await convertToWalkIn.mutateAsync({
        appointmentId: lateFor.id,
        urgentReason: lateFor.urgentReason,
      });
      void refreshAppointments();
      toast.success(`Added as walk-in · Token ${result.token}`);
      setLateFor(null);
      onDone();
    } catch (err) {
      if (isDialogError(err)) toast.error(queueErrorMessage(err));
      else if (shouldRefetch(err)) void refreshAppointments();
      throw err;
    }
  };

  return {
    start,
    checkingIn: checkIn.isPending,
    lateOpen: lateFor !== null,
    dismissLate: () => setLateFor(null),
    convert,
  };
}
