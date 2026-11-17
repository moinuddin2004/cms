import { NotificationAudience, NotificationChannel } from '../notifications.enums';
import { NotificationSettingsService } from './notification-settings.service';

/** Audit M2: a clinic may not put the full patient name (or anything else unsafe) in a PUSH template. */
function setup() {
  const service = Object.create(
    NotificationSettingsService.prototype,
  ) as unknown as Record<string, unknown> & {
    upsertTemplate: NotificationSettingsService['upsertTemplate'];
  };
  const event = {
    code: 'queue.patient_checked_in',
    name: 'Patient waiting',
    audiences: [NotificationAudience.DOCTOR],
    variables: ['patient_name', 'patient_first_name', 'token'],
  };
  service['eventsByCode'] = () => Promise.resolve(new Map([[event.code, event]]));
  const repo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((v: object) => ({ ...v })),
    save: jest.fn((v: object) => Promise.resolve({ id: 't1', ...v })),
  };
  const m = { getRepository: () => repo };
  service['dataSource'] = {
    transaction: (fn: (m: unknown) => Promise<unknown>) => fn(m),
  };
  service['audit'] = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  return service;
}

const dto = (channel: NotificationChannel, body: string, subject = 'Patient checked in') => ({
  eventCode: 'queue.patient_checked_in',
  channel,
  language: 'en',
  subject,
  body,
});
const actor = { userId: 'u1' } as never;

describe('push template placeholder allow-list', () => {
  it.each(['{patient_name} checked in', '{recipient_name} is here', 'Token {token} {patient_name}'])(
    'rejects %s on PUSH',
    async (body) => {
      await expect(
        setup().upsertTemplate('org-1', actor, dto(NotificationChannel.PUSH, body) as never),
      ).rejects.toMatchObject({
        response: { code: 'NOTIFICATION_TEMPLATE_INVALID' },
      });
    },
  );

  it('rejects an unsafe placeholder in the subject too', async () => {
    await expect(
      setup().upsertTemplate(
        'org-1',
        actor,
        dto(NotificationChannel.PUSH, 'Token {token}', '{patient_name}') as never,
      ),
    ).rejects.toBeDefined();
  });

  it('accepts the safe ones on PUSH', async () => {
    await expect(
      setup().upsertTemplate(
        'org-1',
        actor,
        dto(NotificationChannel.PUSH, '{patient_first_name} · Token {token}') as never,
      ),
    ).resolves.toBeDefined();
  });
});
