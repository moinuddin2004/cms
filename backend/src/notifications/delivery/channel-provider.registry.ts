import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../notifications.enums';
import { ChannelProvider } from './channel-provider';
import { DevLogChannelProvider } from './dev-log.provider';
import { InAppChannelProvider } from './in-app.provider';

/** Which provider sends each channel. A real provider calls `use()` to take over its channels. */
@Injectable()
export class ChannelProviderRegistry {
  private readonly byChannel = new Map<NotificationChannel, ChannelProvider>();

  constructor(inApp: InAppChannelProvider, devLog: DevLogChannelProvider) {
    this.use(inApp);
    this.use(devLog);
  }

  use(provider: ChannelProvider): void {
    for (const c of provider.channels) this.byChannel.set(c, provider);
  }

  for(channel: NotificationChannel): ChannelProvider | undefined {
    return this.byChannel.get(channel);
  }
}
