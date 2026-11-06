import {
  CHANNELS_BY_AUDIENCE,
  defaultRuleEnabled,
  NotificationAudience,
  NotificationChannel,
} from './notifications.enums';
import {
  eventChannels,
  NOTIFICATION_EVENT_SEEDS,
} from './seeds/notification-events.seed';

/**
 * The system is for clinic users only (2026-11-05 decision): patients get no
 * message on any channel until the patient follow-up project switches them
 * on deliberately (see docs/notifications-email-plan.md, "Patients later").
 */
describe('notification channels', () => {
  it('reaches patients on no channel', () => {
    expect(CHANNELS_BY_AUDIENCE[NotificationAudience.PATIENT]).toEqual([]);
  });

  it('reaches every clinic-side audience in-app and by email', () => {
    for (const a of [
      NotificationAudience.DOCTOR,
      NotificationAudience.COORDINATOR,
      NotificationAudience.LAB,
      NotificationAudience.STAFF,
    ]) {
      expect(CHANNELS_BY_AUDIENCE[a]).toEqual(['in_app', 'email']);
    }
  });

  it('emails by default only the important events', () => {
    expect(
      defaultRuleEnabled(
        NotificationAudience.DOCTOR,
        NotificationChannel.EMAIL,
      ),
    ).toBe(false);
    expect(
      defaultRuleEnabled(
        NotificationAudience.DOCTOR,
        NotificationChannel.EMAIL,
        true,
      ),
    ).toBe(true);
    expect(
      defaultRuleEnabled(
        NotificationAudience.PATIENT,
        NotificationChannel.EMAIL,
        true,
      ),
    ).toBe(false);
  });
});

describe('event catalog', () => {
  it('has unique codes, and every mandatory event emails by default', () => {
    const codes = NOTIFICATION_EVENT_SEEDS.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const e of NOTIFICATION_EVENT_SEEDS.filter(
      (x) => x.isMandatoryInternal,
    )) {
      expect(e.emailDefault).toBe(true);
    }
  });

  it('queue check-in is in-app only', () => {
    const e = NOTIFICATION_EVENT_SEEDS.find(
      (x) => x.code === 'queue.patient_checked_in',
    )!;
    expect(eventChannels(e)).toEqual(['in_app']);
  });
});
