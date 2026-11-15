// Public barrel of the Today snapshot data layer (M1-15a). The screen arrives in M1-15.
export * from './api/today.api';
export { todayKeys } from './api/today.keys';
export {
  useDoctorsNow,
  useNextAppointments,
  useTodayCollections,
  useTodayStats,
} from './hooks/useToday';
export type { GatedQuery } from './hooks/gated-query';
export { visibleTodayBlocks } from './lib/today-blocks';
export type { TodayBlockId } from './lib/today-blocks';
export type * from './types/today.types';
export { TodayPage } from './pages/TodayPage';
