import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../notifications.enums';
import { ChannelProvider } from './channel-provider';
import { DevLogChannelProvider } from './dev-log.provider';
import { EmailChannelProvider } from './email.provider';
import { InAppChannelProvider } from './in-app.provider';

/**
 * Which provider sends each channel. A real provider calls `use()` to take
 * over its channels. Email is real SMTP when configured (`SMTP_HOST` or
 * `SMTP_USER`), else the dev-log stand-in.
 */
@Injectable()
export class ChannelProviderRegistry {
  private readonly byChannel = new Map<NotificationChannel, ChannelProvider>();

  constructor(
    inApp: InAppChannelProvider,
    devLog: DevLogChannelProvider,
    email: EmailChannelProvider,
  ) {
    this.use(inApp);
    this.use(devLog);
    if (email.enabled) this.use(email);
  }

  use(provider: ChannelProvider): void {
    for (const c of provider.channels) this.byChannel.set(c, provider);
  }

  for(channel: NotificationChannel): ChannelProvider | undefined {
    return this.byChannel.get(channel);
  }
}
