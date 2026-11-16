import {
  CHANNELS_BY_AUDIENCE,
  defaultAudienceEnabled,
  defaultRuleEnabled,
  NotificationAudience,
  NotificationChannel,
  RecipientType,
} from './notifications.enums';
import {
  defaultTemplateSeeds,
  eventChannels,
  NOTIFICATION_EVENT_SEEDS,
} from './seeds/notification-events.seed';
import { channelsFor } from './services/notification.service';
import { renderTemplate } from './templates/template-render';

/**
 * The system is for clinic users, plus the patient APP's push (M3-07): patients
 * get no email / SMS / WhatsApp until the patient follow-up project switches
 * them on deliberately (see docs/notifications-email-plan.md, "Patients later").
 */
describe('notification channels', () => {
  it('reaches patients on app push only', () => {
    expect(CHANNELS_BY_AUDIENCE[NotificationAudience.PATIENT]).toEqual([
      'push',
    ]);
  });

  it('reaches clinic-side audiences in-app, by email and by push (labs: no push)', () => {
    for (const a of [
      NotificationAudience.DOCTOR,
      NotificationAudience.COORDINATOR,
      NotificationAudience.STAFF,
    ]) {
      expect(CHANNELS_BY_AUDIENCE[a]).toEqual(['in_app', 'email', 'push']);
    }
    expect(CHANNELS_BY_AUDIENCE[NotificationAudience.LAB]).toEqual([
      'in_app',
      'email',
    ]);
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

  it('pushes by default only for events that opt in; patients get no other default', () => {
    expect(
      defaultRuleEnabled(NotificationAudience.DOCTOR, NotificationChannel.PUSH),
    ).toBe(false);
    expect(
      defaultRuleEnabled(
        NotificationAudience.DOCTOR,
        NotificationChannel.PUSH,
        false,
        true,
      ),
    ).toBe(true);
    expect(
      defaultRuleEnabled(
        NotificationAudience.PATIENT,
        NotificationChannel.PUSH,
        false,
        true,
      ),
    ).toBe(true);
    expect(
      defaultRuleEnabled(NotificationAudience.PATIENT, NotificationChannel.PUSH),
    ).toBe(false);
    expect(
      defaultRuleEnabled(
        NotificationAudience.PATIENT,
        NotificationChannel.IN_APP,
        true,
        true,
      ),
    ).toBe(false);
    expect(defaultAudienceEnabled(NotificationAudience.PATIENT)).toBe(true);
  });

  it('channelsFor only offers push when the event itself allows it', () => {
    const doctor = {
      audience: NotificationAudience.DOCTOR,
      type: RecipientType.USER,
    };
    // No event = "every channel of the audience", which must not start pushing.
    expect(channelsFor(doctor)).toEqual(['in_app', 'email']);
    expect(channelsFor(doctor, { channels: null })).toEqual([
      'in_app',
      'email',
    ]);
    expect(
      channelsFor(doctor, {
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      }),
    ).toEqual(['in_app', 'push']);
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

  it('queue check-in is in-app + push', () => {
    const e = NOTIFICATION_EVENT_SEEDS.find(
      (x) => x.code === 'queue.patient_checked_in',
    )!;
    expect(eventChannels(e)).toEqual(['in_app', 'push']);
  });

  it('push is opt-in per event: push in the channels ⇔ pushDefault', () => {
    for (const e of NOTIFICATION_EVENT_SEEDS) {
      expect(eventChannels(e).includes(NotificationChannel.PUSH)).toBe(
        e.pushDefault === true,
      );
    }
    expect(
      NOTIFICATION_EVENT_SEEDS.filter((e) =>
        eventChannels(e).includes(NotificationChannel.PUSH),
      ).map((e) => e.code),
    ).toEqual([
      'queue.patient_checked_in',
      'queue.turn_near',
      'queue.called',
      'appointment.reminder',
    ]);
  });

  it('creates a push template only for the push events', () => {
    expect(
      defaultTemplateSeeds()
        .filter((t) => t.channel === NotificationChannel.PUSH)
        .map((t) => t.eventCode),
    ).toEqual([
      'queue.patient_checked_in',
      'queue.turn_near',
      'queue.called',
      'appointment.reminder',
    ]);
  });

  it('patient pushes carry no clinical text (docs/03 §5)', () => {
    const patientPushes = NOTIFICATION_EVENT_SEEDS.filter(
      (e) =>
        e.audiences.includes(NotificationAudience.PATIENT) &&
        eventChannels(e).includes(NotificationChannel.PUSH),
    );
    expect(patientPushes.map((e) => e.code)).toEqual([
      'queue.turn_near',
      'queue.called',
      'appointment.reminder',
    ]);
    const allowed = [
      '{clinic_name}',
      '{ahead_text}',
      '{doctor_name}',
      '{appointment_time}',
    ];
    for (const e of patientPushes) {
      const text = `${e.pushTitle ?? e.title} ${e.pushBody ?? e.body}`;
      expect(text).not.toMatch(
        /medicine|diagnos|prescri|treatment|notes?|patient_name|reason/i,
      );
      for (const v of text.match(/\{\w+\}/g) ?? []) {
        expect(allowed).toContain(v);
      }
    }
  });

  it('push wording carries the patient first name + token only (docs/03 §5)', () => {
    const e = NOTIFICATION_EVENT_SEEDS.find(
      (x) => x.code === 'queue.patient_checked_in',
    )!;
    expect(e.pushTitle).toBe('Patient checked in');
    expect(e.pushBody).toContain('{patient_first_name}');
    expect(e.pushBody).not.toContain('{patient_name}');
    expect(renderTemplate(e.pushBody!, { token: 'A-012' })).not.toContain(
      'Ali',
    );

    const pushTemplate = defaultTemplateSeeds().find(
      (t) => t.eventCode === e.code && t.channel === NotificationChannel.PUSH,
    )!;
    expect(pushTemplate.subject).toBe('Patient checked in');
    expect(pushTemplate.body).toBe(e.pushBody);
    expect(
      renderTemplate(pushTemplate.body, {
        patient_name: 'Ali Khan',
        patient_first_name: 'Ali',
        token: 'A-012',
      }),
    ).toBe('Ali · Token A-012');
  });
});
