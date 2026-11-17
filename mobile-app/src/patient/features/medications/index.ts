export { ReminderSync } from './components/ReminderSync';
// Screens live in './pages' (separate entry): this barrel exports no screens, so pure logic and sign-out
// can import it without pulling in expo-router / keyboard-controller (jest cannot load those).
export { clearMedicationLocalState } from './lib/clear-local-state';
export { medicationKeys } from './api/medications.keys';
export { useMedications, useEffectiveDoseEvents } from './hooks/useMedications';
export { useDoseActions } from './hooks/useDoseActions';
export { useNotificationPermission } from './hooks/useNotificationPermission';
export { useReminderProfiles } from './hooks/useReminderProfiles';
export { useDoseQueueStore } from './lib/dose-queue';
export { mealLabel } from './lib/reminder-content';
export { DAY_MS, actionsByDose, expandDoses, localDayStart, localYmd } from './lib/doses';
export type {
  DoseAction,
  DoseEvent,
  MealRelation,
  MedicationSchedule,
} from './types/medications.types';
export { replanRemindersFromCache } from './lib/background-replan';
