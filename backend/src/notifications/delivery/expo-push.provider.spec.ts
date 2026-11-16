import type { ExpoPushMessage } from 'expo-server-sdk';
import {
  NotificationAudience,
  NotificationChannel,
  OutboxStatus,
  RecipientType,
} from '../notifications.enums';
import {
  OutgoingNotification,
  PermanentSendError,
  SkipSendError,
} from './channel-provider';
import {
  channelIdFor,
  ExpoClient,
  ExpoPushClientFactory,
  ExpoPushProvider,
  RECEIPT_CHECK_DELAY_MS,
} from './expo-push.provider';

const TOKEN = 'ExponentPushToken[device-1]';

/** A claimed `queue.patient_checked_in` push row, as the worker hands it over. */
const message = (
  over: Partial<OutgoingNotification> = {},
): OutgoingNotification => ({
  id: 'o1',
  organizationId: 'org-1',
  locationId: 'loc-1',
  eventCode: 'queue.patient_checked_in',
  audience: NotificationAudience.DOCTOR,
  recipientType: RecipientType.USER,
  recipientId: 'u1',
  channel: NotificationChannel.PUSH,
  entityId: 'entry-1',
  payload: {
    title: 'Patient checked in',
    body: 'Ali · Token A-012',
    link: '/queue/doctor',
    language: 'en' as never,
    to: null,
    recipientName: 'Dr A',
    providerTemplateRef: null,
    variables: { patient_first_name: 'Ali', token: 'A-012' },
    reason: 'enabled',
  },
  attempts: 1,
  ...over,
});

/** The provider with a fake device service and a mocked Expo client. */
function setup(
  opts: {
    tokens?: string[];
    patientTokens?: string[];
    tickets?: unknown[];
    receipts?: Record<string, unknown>;
  } = {},
) {
  const tokens = opts.tokens ?? [TOKEN];
  const sent: ExpoPushMessage[][] = [];
  const removed: string[][] = [];
  const devices = {
    pushTokensOf: jest.fn(() => Promise.resolve(tokens)),
    removeTokens: jest.fn((list: string[]) => {
      removed.push(list);
      return Promise.resolve(list.length);
    }),
  };
  const patientDevices = {
    pushTokensForPatient: jest.fn(() =>
      Promise.resolve(opts.patientTokens ?? []),
    ),
    // A dead token is removed from both tables; `removed` tracks the staff one.
    removeTokens: jest.fn(() => Promise.resolve(0)),
  };
  const client: ExpoClient = {
    chunkPushNotifications: (messages) => [messages],
    sendPushNotificationsAsync: jest.fn((chunk) => {
      sent.push(chunk);
      return Promise.resolve(
        (opts.tickets ??
          chunk.map((_, i) => ({
            status: 'ok',
            id: `receipt-${i + 1}`,
          }))) as never,
      );
    }),
    chunkPushNotificationReceiptIds: (ids) => [ids],
    getPushNotificationReceiptsAsync: jest.fn(() =>
      Promise.resolve((opts.receipts ?? {}) as never),
    ),
  };
  const factory = {
    get: () => Promise.resolve(client),
  } as unknown as ExpoPushClientFactory;
  const provider = new ExpoPushProvider(
    devices as never,
    patientDevices as never,
    factory,
  );
  return { provider, devices, patientDevices, client, sent, removed };
}

describe('ExpoPushProvider', () => {
  it('sends the rendered payload to every device with the queue channel and tap data', async () => {
    const { provider, sent } = setup();
    const result = await provider.send(message());

    expect(result).toEqual({ providerMessageId: 'receipt-1' });
    expect(sent).toHaveLength(1);
    expect(sent[0][0]).toMatchObject({
      to: TOKEN,
      title: 'Patient checked in',
      body: 'Ali · Token A-012',
      channelId: 'queue',
      data: {
        space: 'staff',
        type: 'queue.patient_checked_in',
        route: '/queue/doctor',
        organizationId: 'org-1',
        locationId: 'loc-1',
        entityId: 'entry-1',
      },
    });
  });

  it('uses the general channel for non-queue events', () => {
    expect(channelIdFor('queue.patient_checked_in')).toBe('queue');
    expect(channelIdFor('inventory.low_stock')).toBe('general');
  });

  it('skips (never fails) a user with no registered device', async () => {
    const { provider, client, devices } = setup({ tokens: [] });
    const err = await provider.send(message()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SkipSendError);
    expect((err as SkipSendError).status).toBe(OutboxStatus.SKIPPED_NO_DEVICE);
    expect(client.sendPushNotificationsAsync).not.toHaveBeenCalled();
    expect(devices.removeTokens).not.toHaveBeenCalled();
  });

  it('deletes a device Expo reports as DeviceNotRegistered (ticket)', async () => {
    const { provider, removed } = setup({
      tickets: [
        {
          status: 'error',
          message: 'Device not registered',
          details: { error: 'DeviceNotRegistered', expoPushToken: TOKEN },
        },
      ],
    });
    const err = await provider.send(message()).catch((e: unknown) => e);

    expect(removed).toEqual([[TOKEN]]);
    expect(err).toBeInstanceOf(SkipSendError);
    expect((err as SkipSendError).status).toBe(OutboxStatus.SKIPPED_NO_DEVICE);
  });

  it('keeps the good tickets when one device is gone', async () => {
    const { provider, removed } = setup({
      tokens: [TOKEN, 'ExponentPushToken[device-2]'],
      tickets: [
        { status: 'ok', id: 'receipt-ok' },
        {
          status: 'error',
          message: 'Device not registered',
          details: {
            error: 'DeviceNotRegistered',
            expoPushToken: 'ExponentPushToken[device-2]',
          },
        },
      ],
    });

    await expect(provider.send(message())).resolves.toEqual({
      providerMessageId: 'receipt-ok',
    });
    expect(removed).toEqual([['ExponentPushToken[device-2]']]);
  });

  it('a non-DeviceNotRegistered ticket is permanent', async () => {
    const { provider } = setup({
      tickets: [
        {
          status: 'error',
          message: 'Message too big',
          details: { error: 'MessageTooBig' },
        },
      ],
    });
    await expect(provider.send(message())).rejects.toBeInstanceOf(
      PermanentSendError,
    );
  });

  it('checks the receipts after 15 minutes and drops an unregistered device', async () => {
    jest.useFakeTimers();
    try {
      const { provider, removed, client } = setup({
        receipts: {
          'receipt-1': {
            status: 'error',
            message: 'Device not registered',
            details: {
              error: 'DeviceNotRegistered',
              expoPushToken: TOKEN,
            },
          },
        },
      });
      await provider.send(message());
      expect(client.getPushNotificationReceiptsAsync).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(RECEIPT_CHECK_DELAY_MS);
      expect(client.getPushNotificationReceiptsAsync).toHaveBeenCalledWith([
        'receipt-1',
      ]);
      expect(removed).toEqual([[TOKEN]]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a push to a lab recipient is permanent', async () => {
    const { provider } = setup();
    await expect(
      provider.send(message({ recipientType: RecipientType.LAB })),
    ).rejects.toBeInstanceOf(PermanentSendError);
  });

  describe('patient recipients (M3-07)', () => {
    const patientMessage = () =>
      message({
        eventCode: 'queue.turn_near',
        audience: NotificationAudience.PATIENT,
        recipientType: RecipientType.PATIENT,
        recipientId: 'patient-1',
        payload: {
          ...message().payload,
          title: 'Your turn is near',
          body: 'City Dental: 2 people ahead of you',
          link: '/visit/entry-1',
        },
      });

    it("sends to the account's phones with the patient space and the visit route", async () => {
      const { provider, sent, patientDevices, devices } = setup({
        patientTokens: [TOKEN],
      });
      await provider.send(patientMessage());

      expect(patientDevices.pushTokensForPatient).toHaveBeenCalledWith(
        'org-1',
        'patient-1',
      );
      expect(devices.pushTokensOf).not.toHaveBeenCalled();
      expect(sent[0][0]).toMatchObject({
        to: TOKEN,
        title: 'Your turn is near',
        body: 'City Dental: 2 people ahead of you',
        channelId: 'queue',
        data: {
          space: 'patient',
          type: 'queue.turn_near',
          route: '/visit/entry-1',
          entityId: 'entry-1',
        },
      });
    });

    it('skips a patient whose link or phone is gone', async () => {
      const { provider, client } = setup({ patientTokens: [] });
      const err = await provider
        .send(patientMessage())
        .catch((e: unknown) => e);
      expect((err as SkipSendError).status).toBe(OutboxStatus.SKIPPED_NO_DEVICE);
      expect(client.sendPushNotificationsAsync).not.toHaveBeenCalled();
    });

    it('the reminder goes out on the reminders channel', () => {
      expect(channelIdFor('appointment.reminder')).toBe('reminders');
    });
  });
});
