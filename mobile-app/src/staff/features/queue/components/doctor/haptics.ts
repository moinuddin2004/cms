import * as Haptics from 'expo-haptics';

/** Feedback for a queue action that succeeded / was refused (docs/05 §7). A missing motor is not an error. */
export function hapticSuccess(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function hapticWarning(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}
