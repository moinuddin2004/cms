import { t as translateNow, type MessageKey, type TFunction } from '@/core/i18n';

import type { ReminderRequest } from './plan-reminders';
import type { MealRelation } from '../types/medications.types';

export interface ReminderContent {
  title: string;
  body: string;
}

const MEAL_KEYS: Record<Exclude<MealRelation, 'NONE'>, MessageKey> = {
  BEFORE_MEAL: 'reminders.meal.BEFORE_MEAL',
  AFTER_MEAL: 'reminders.meal.AFTER_MEAL',
  WITH_MEAL: 'reminders.meal.WITH_MEAL',
  EMPTY_STOMACH: 'reminders.meal.EMPTY_STOMACH',
};

/** "Ali R. Khan" → "Ali". */
export const firstName = (name: string | null | undefined): string | null => {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
};

/** The translated meal hint, or `null` for "no relation" / an unknown code. */
export const mealLabel = (meal: MealRelation | null | undefined, t: TFunction = translateNow): string | null =>
  meal && meal !== 'NONE' && meal in MEAL_KEYS ? t(MEAL_KEYS[meal]) : null;

/**
 * The lock-screen text of one reminder. A private reminder reads only "Medicine reminder for Ali":
 * no medicine, dose or meal (docs/03 §5). Never a diagnosis or clinic name.
 */
export function buildReminderContent(r: ReminderRequest, t: TFunction = translateNow): ReminderContent {
  const name = firstName(r.profileName);
  if (r.private || !r.medicineName) {
    return {
      title: name ? t('reminders.notify.privateTitleFor', { name }) : t('reminders.notify.privateTitle'),
      body: t('reminders.notify.privateBody'),
    };
  }
  const detail = [r.doseText, mealLabel(r.mealRelation, t)].filter(Boolean).join(' · ');
  return {
    title: name
      ? t('reminders.notify.titleFor', { name, medicine: r.medicineName })
      : r.medicineName,
    body: detail || t('reminders.notify.bodyFallback'),
  };
}
