// Public barrel of the appointments data layer (M1-14a). Screens arrive in M1-14 / M1-15.
export * from './api/appointments.api';
export { appointmentKeys } from './api/appointments.keys';
export {
  useAppointment,
  useAppointmentStats,
  useArrivals,
  useDayAppointments,
  useDoctors,
  useUpcomingAppointments,
} from './hooks/useAppointments';
export { selectArrivals } from './lib/arrivals';
export { dayStrip } from './lib/day-strip';
export { groupByHour } from './lib/group-by-hour';
export type { HourGroup } from './lib/group-by-hour';
export type * from './types/appointments.types';
