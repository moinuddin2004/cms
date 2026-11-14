import { checkInAppointment, convertToWalkIn, registerWalkIn } from '../api/queue.api';
import type { UrgentInput, WalkInInput } from '../types/queue.types';
import { useQueueMutation } from './queue-mutation';

/** Arrivals: a walk-in, or an appointment checking in / converting to a walk-in. */

export const useWalkIn = () =>
  useQueueMutation((vars: WalkInInput, ctx) => registerWalkIn(vars, ctx));

export const useCheckIn = () =>
  useQueueMutation((vars: { appointmentId: string } & UrgentInput, ctx) =>
    checkInAppointment(vars, ctx),
  );

export const useConvertToWalkIn = () =>
  useQueueMutation((vars: { appointmentId: string } & UrgentInput, ctx) =>
    convertToWalkIn(vars, ctx),
  );
