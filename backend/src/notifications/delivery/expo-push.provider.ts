import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Expo from 'expo-server-sdk';
import type {
  ExpoPushMessage,
  ExpoPushReceiptId,
  ExpoPushTicket,
} from 'expo-server-sdk';
import { DevicesService } from 'src/devices/devices.service';
import {
  NotificationChannel,
  OutboxStatus,
  RecipientType,
} from '../notifications.enums';
import {
  ChannelProvider,
  OutgoingNotification,
  PermanentSendError,
  SendResult,
  SkipSendError,
} from './channel-provider';

/** Expo asks for push receipts no sooner than ~15 minutes after the tickets. */
export const RECEIPT_CHECK_DELAY_MS = 15 * 60_000;

/** The part of `expo-server-sdk` this provider uses (faked in unit tests). */
export type ExpoClient = Pick<
  Expo,
  | 'chunkPushNotifications'
  | 'sendPushNotificationsAsync'
  | 'chunkPushNotificationReceiptIds'
  | 'getPushNotificationReceiptsAsync'
>;

/**
 * Builds the real Expo client on first use. Lazy so the ESM-only SDK is never
 * loaded by tests or by a deploy without push, and one client (with its
 * connection reuse) is shared by the whole process.
 */
@Injectable()
export class ExpoPushClientFactory {
  private client: Promise<ExpoClient> | null = null;

  constructor(private readonly config: ConfigService) {}

  get(): Promise<ExpoClient> {
    this.client ??= import('expo-server-sdk').then(
      ({ default: ExpoClientClass }) =>
        new ExpoClientClass({
          // Optional: only needed when the Expo project enables push security.
          accessToken:
            this.config.get<string>('EXPO_ACCESS_TOKEN') || undefined,
        }),
    );
    return this.client;
  }
}

/**
 * Expo remote push for the staff space (M1-04, 07 §8). Sends the rendered
 * outbox title/body to every device the user registered, one ticket per
 * chunk; a `DeviceNotRegistered` ticket (uninstalled app, restored phone)
 * drops that device row, and the same check runs again on the receipts after
 * 15 minutes. No device at all → `skipped_no_device`, never a failure.
 *
 * Push wording comes from the event's `push` template, which the seeds keep
 * privacy-safe (docs/03 §5: patient first name + token only).
 */
@Injectable()
export class ExpoPushProvider implements ChannelProvider, OnModuleDestroy {
  readonly name = 'expo';
  readonly channels = [NotificationChannel.PUSH] as const;

  private readonly logger = new Logger(ExpoPushProvider.name);
  private readonly receiptTimers = new Set<NodeJS.Timeout>();

  constructor(
    private readonly devices: DevicesService,
    private readonly clients: ExpoPushClientFactory,
  ) {}

  onModuleDestroy(): void {
    for (const timer of this.receiptTimers) clearTimeout(timer);
    this.receiptTimers.clear();
  }

  async send(n: OutgoingNotification): Promise<SendResult> {
    if (n.recipientType !== RecipientType.USER) {
      throw new PermanentSendError('Push notifications need a user recipient');
    }
    const tokens = await this.devices.pushTokensOf(n.recipientId);
    if (!tokens.length) {
      throw new SkipSendError(
        OutboxStatus.SKIPPED_NO_DEVICE,
        `User ${n.recipientId} has no registered push device`,
      );
    }

    const client = await this.clients.get();
    const messages = tokens.map((token) => this.messageFor(n, token));
    const receiptIds: ExpoPushReceiptId[] = [];
    const unregistered: string[] = [];
    const failures: string[] = [];
    let offset = 0;
    for (const chunk of client.chunkPushNotifications(messages)) {
      const tickets = await client.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, index) => {
        const token = tokens[offset + index];
        this.collect(ticket, token, receiptIds, unregistered, failures);
      });
      offset += chunk.length;
    }

    if (unregistered.length) await this.devices.removeTokens(unregistered);
    if (!receiptIds.length) {
      if (failures.length) {
        throw new PermanentSendError(`Push rejected: ${failures[0]}`);
      }
      // Every ticket was DeviceNotRegistered; those rows are gone now.
      throw new SkipSendError(
        OutboxStatus.SKIPPED_NO_DEVICE,
        'Every device of this user is no longer registered',
      );
    }
    if (failures.length) {
      this.logger.warn(
        `Push partially failed for ${n.id}: ${failures[0]} (${failures.length} ticket(s))`,
      );
    }
    this.scheduleReceiptCheck(client, receiptIds);
    return { providerMessageId: receiptIds.join(',') };
  }

  private collect(
    ticket: ExpoPushTicket,
    token: string,
    receiptIds: ExpoPushReceiptId[],
    unregistered: string[],
    failures: string[],
  ): void {
    if (ticket.status === 'ok') {
      receiptIds.push(ticket.id);
      return;
    }
    if (ticket.details?.error === 'DeviceNotRegistered') {
      unregistered.push(ticket.details.expoPushToken ?? token);
      return;
    }
    failures.push(
      `${ticket.details?.error ?? 'UnknownError'}: ${ticket.message ?? ''}`,
    );
  }

  /**
   * Expo's receipt tells the truth a few minutes after the ticket. One timer
   * per send, in the worker process only (`NotificationRelayService` role);
   * a restart loses the pending check, which is safe — the token simply stays
   * until the next send reports it.
   */
  private scheduleReceiptCheck(
    client: ExpoClient,
    receiptIds: ExpoPushReceiptId[],
  ): void {
    if (!receiptIds.length) return;
    const timer = setTimeout(() => {
      this.receiptTimers.delete(timer);
      void this.checkReceipts(client, receiptIds);
    }, RECEIPT_CHECK_DELAY_MS);
    timer.unref?.();
    this.receiptTimers.add(timer);
  }

  private async checkReceipts(
    client: ExpoClient,
    receiptIds: ExpoPushReceiptId[],
  ): Promise<void> {
    try {
      const unregistered: string[] = [];
      for (const chunk of client.chunkPushNotificationReceiptIds(receiptIds)) {
        const receipts = await client.getPushNotificationReceiptsAsync(chunk);
        for (const receipt of Object.values(receipts)) {
          if (receipt.status !== 'error') continue;
          if (receipt.details?.error === 'DeviceNotRegistered') {
            if (receipt.details.expoPushToken) {
              unregistered.push(receipt.details.expoPushToken);
            }
            continue;
          }
          this.logger.warn(
            `Push receipt error: ${receipt.details?.error ?? receipt.message}`,
          );
        }
      }
      if (unregistered.length) await this.devices.removeTokens(unregistered);
    } catch (err) {
      this.logger.warn(`Push receipt check failed: ${(err as Error).message}`);
    }
  }

  private messageFor(n: OutgoingNotification, token: string): ExpoPushMessage {
    return {
      to: token,
      title: n.payload.title ?? '',
      body: n.payload.body,
      channelId: channelIdFor(n.eventCode),
      data: {
        space: 'staff',
        type: n.eventCode,
        route: n.payload.link ?? null,
        organizationId: n.organizationId,
        locationId: n.locationId,
        entityId: n.entityId,
      },
    };
  }
}

/**
 * Android notification channel (created by the app in M0-07): queue alerts
 * are allowed to banner on the lock screen, everything else is quieter.
 */
export function channelIdFor(eventCode: string): string {
  return eventCode.startsWith('queue.') ? 'queue' : 'general';
}
