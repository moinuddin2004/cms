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
    patientApp?: boolean;
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
  const featureFlags = {
    isFeatureEnabled: jest.fn(() => Promise.resolve(opts.patientApp ?? true)),
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
    featureFlags as never,
    factory,
  );
  return { provider, devices, patientDevices, featureFlags, client, sent, removed };
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

  it('queue pushes expire after a few minutes; others do not', async () => {
    const { provider, sent } = setup();
    await provider.send(message());
    await provider.send(message({ eventCode: 'appointment.reminder' }));
    expect(sent[0][0]).toMatchObject({ ttl: 300 });
    expect(sent[1][0]).not.toHaveProperty('ttl');
  });

  it('MessageRateExceeded is retried with backoff for those messages only', async () => {
    const T2 = 'ExponentPushToken[device-2]';
    const { provider, client, sent } = setup({ tokens: [TOKEN, T2] });
    const waits: number[] = [];
    provider.sleep = (ms) => {
      waits.push(ms);
      return Promise.resolve();
    };
    (client.sendPushNotificationsAsync as jest.Mock)
      .mockReset()
      .mockImplementationOnce((chunk: ExpoPushMessage[]) => {
        sent.push(chunk);
        return Promise.resolve([
          { status: 'ok', id: 'r1' },
          { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } },
        ]);
      })
      .mockImplementationOnce((chunk: ExpoPushMessage[]) => {
        sent.push(chunk);
        return Promise.resolve([{ status: 'ok', id: 'r2' }]);
      });

    await expect(provider.send(message())).resolves.toEqual({ providerMessageId: 'r1,r2' });
    expect(waits).toEqual([1000]);
    expect(sent[1].map((m) => m.to)).toEqual([T2]); // the accepted one is not re-sent
  });

  it('gives up after the retries without failing the whole row permanently when one ticket was ok', async () => {
    const { provider, client } = setup({ tokens: [TOKEN] });
    provider.sleep = () => Promise.resolve();
    (client.sendPushNotificationsAsync as jest.Mock).mockReset().mockResolvedValue([
      { status: 'error', message: 'slow', details: { error: 'MessageRateExceeded' } },
    ]);
    await expect(provider.send(message())).rejects.toBeInstanceOf(PermanentSendError);
    expect(client.sendPushNotificationsAsync).toHaveBeenCalledTimes(4);
  });

  it('a network error after the first chunk keeps what was sent instead of re-sending it', async () => {
    const T2 = 'ExponentPushToken[device-2]';
    const { provider, client } = setup({ tokens: [TOKEN, T2] });
    (client as { chunkPushNotifications: unknown }).chunkPushNotifications = (m: ExpoPushMessage[]) => [[m[0]], [m[1]]];
    (client.sendPushNotificationsAsync as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce([{ status: 'ok', id: 'r1' }])
      .mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(provider.send(message())).resolves.toEqual({ providerMessageId: 'r1' });
  });

  it('a network error on the very first chunk is retried by the dispatcher', async () => {
    const { provider, client } = setup();
    (client.sendPushNotificationsAsync as jest.Mock).mockReset().mockRejectedValue(new Error('ECONNRESET'));
    await expect(provider.send(message())).rejects.toThrow('ECONNRESET');
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

    it('a clinic with the patient app off (org or location) sends no patient push', async () => {
      const { provider, client, featureFlags } = setup({
        patientTokens: [TOKEN],
        patientApp: false,
      });
      const err = await provider.send(patientMessage()).catch((e: unknown) => e);
      expect((err as SkipSendError).status).toBe(OutboxStatus.SKIPPED_NO_DEVICE);
      expect(featureFlags.isFeatureEnabled).toHaveBeenCalledWith('org-1', 'patient_app', 'loc-1');
      expect(client.sendPushNotificationsAsync).not.toHaveBeenCalled();
    });

    it('the reminder goes out on the reminders channel', () => {
      expect(channelIdFor('appointment.reminder')).toBe('reminders');
    });
  });
});
