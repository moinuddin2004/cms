import {
  CHANNELS_BY_AUDIENCE,
  NotificationAudience,
} from './notifications.enums';

/**
 * The system is for clinic users only (2026-11-05 decision): patients get no
 * message on any channel until the patient follow-up project switches them
 * on deliberately (see docs/notifications-email-plan.md, "Patients later").
 */
describe('notification channels', () => {
  it('reaches patients on no channel', () => {
    expect(CHANNELS_BY_AUDIENCE[NotificationAudience.PATIENT]).toEqual([]);
  });

  it('keeps in-app for every internal audience', () => {
    for (const a of [
      NotificationAudience.DOCTOR,
      NotificationAudience.COORDINATOR,
      NotificationAudience.LAB,
    ]) {
      expect(CHANNELS_BY_AUDIENCE[a]).toContain('in_app');
    }
  });
});
