import { DataSource } from 'typeorm';
import {
  NotificationAudience,
  NotificationChannel,
  RecipientType,
} from '../notifications.enums';
import { OutgoingNotification, PermanentSendError } from './channel-provider';
import { InAppChannelProvider } from './in-app.provider';

const message = (
  over: Partial<OutgoingNotification> = {},
): OutgoingNotification => ({
  id: 'outbox-1',
  organizationId: 'org-1',
  eventCode: 'order.accepted',
  audience: NotificationAudience.DOCTOR,
  recipientType: RecipientType.USER,
  recipientId: 'user-1',
  channel: NotificationChannel.IN_APP,
  payload: {
    title: 'Order 7 accepted',
    body: 'Lab accepted order 7',
    link: '/lab-orders/7',
    language: 'en' as never,
    to: null,
    recipientName: null,
    providerTemplateRef: null,
    variables: {},
    reason: 'sent',
  },
  attempts: 1,
  ...over,
});

/** A DataSource whose transaction runs `fn` on a manager answering queries in order. */
function fakeDataSource(answers: unknown[][]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const manager = {
    query: jest.fn((sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return Promise.resolve(answers.shift() ?? []);
    }),
  };
  const ds = {
    transaction: (fn: (m: typeof manager) => Promise<unknown>) => fn(manager),
  } as unknown as DataSource;
  return { ds, calls };
}

describe('InAppChannelProvider', () => {
  it('stores the copy and publishes notification.new to the user room', async () => {
    const { ds, calls } = fakeDataSource([
      [{ id: 'un-1', created_at: new Date('2026-11-05T10:00:00Z') }],
      [],
    ]);
    const result = await new InAppChannelProvider(ds).send(message());

    expect(result).toEqual({ providerMessageId: 'un-1' });
    expect(calls).toHaveLength(2);
    expect(calls[1].sql).toContain('INSERT INTO outbox');
    expect(calls[1].sql).toContain("pg_notify('queue_outbox'");
    expect(calls[1].params[1]).toBe('user:user-1');
    expect(JSON.parse(calls[1].params[2] as string)).toMatchObject({
      type: 'notification.new',
      id: 'un-1',
      title: 'Order 7 accepted',
      link: '/lab-orders/7',
      createdAt: '2026-11-05T10:00:00.000Z',
    });
  });

  it('a retried send re-uses the copy and publishes nothing (no second toast)', async () => {
    const { ds, calls } = fakeDataSource([[], [{ id: 'un-1' }]]);
    const result = await new InAppChannelProvider(ds).send(message());

    expect(result).toEqual({ providerMessageId: 'un-1' });
    expect(calls.some((c) => c.sql.includes('INSERT INTO outbox'))).toBe(false);
  });

  it('refuses a non-user recipient', async () => {
    const { ds } = fakeDataSource([]);
    await expect(
      new InAppChannelProvider(ds).send(
        message({ recipientType: RecipientType.LAB }),
      ),
    ).rejects.toBeInstanceOf(PermanentSendError);
  });
});
