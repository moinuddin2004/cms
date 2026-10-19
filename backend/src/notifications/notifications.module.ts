import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EngineModule } from 'src/engine/engine.module';
import { MyNotificationsController } from './controllers/my-notifications.controller';
import { NotificationSettingsController } from './controllers/notification-settings.controller';
import { ChannelProviderRegistry } from './delivery/channel-provider.registry';
import { DevLogChannelProvider } from './delivery/dev-log.provider';
import { InAppChannelProvider } from './delivery/in-app.provider';
import { NotificationDispatcher } from './delivery/notification-dispatcher.service';
import { NotificationRecipientsRegistry } from './effects/notification-recipients.registry';
import { NotifyEffect } from './effects/notify.effect';
import { NotificationAudienceSetting } from './entities/notification-audience-setting.entity';
import { NotificationEvent } from './entities/notification-event.entity';
import { NotificationOutbox } from './entities/notification-outbox.entity';
import { NotificationRule } from './entities/notification-rule.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { PatientCommPref } from './entities/patient-comm-pref.entity';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationSeedService } from './seeds/notification-seed.service';
import { NotificationService } from './services/notification.service';
import { NotificationSettingsService } from './services/notification-settings.service';
import { UserNotificationsService } from './services/user-notifications.service';

/**
 * Notifications (lab ERD §7, §16, §17 `notify`). Everything goes through
 * `NotificationService.enqueue(tx, …)` → `notification_outbox`; the worker
 * (`NotificationsRuntimeModule`, jobs roles only) sends committed rows via
 * channel providers. Other modules: import this module, then either call
 * `enqueue` in their transaction, or put `notify` on a workflow transition
 * and register their entity type's recipients in
 * `NotificationRecipientsRegistry`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEvent,
      NotificationAudienceSetting,
      NotificationRule,
      NotificationTemplate,
      PatientCommPref,
      NotificationOutbox,
      UserNotification,
    ]),
    EngineModule,
  ],
  controllers: [NotificationSettingsController, MyNotificationsController],
  providers: [
    NotificationService,
    NotificationSettingsService,
    UserNotificationsService,
    NotificationSeedService,
    NotificationRecipientsRegistry,
    NotifyEffect,
    InAppChannelProvider,
    DevLogChannelProvider,
    ChannelProviderRegistry,
    NotificationDispatcher,
  ],
  exports: [
    NotificationService,
    NotificationRecipientsRegistry,
    ChannelProviderRegistry,
    NotificationDispatcher,
  ],
})
export class NotificationsModule {}
