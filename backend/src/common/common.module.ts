import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailLog } from './mail/email-log.entity';
import { EmailQuota } from './mail/email-quota.service';
import { MailTransport } from './mail/mail-transport.service';
import { MailService } from './services/mail.service';
import { RequestContextService } from './services/request-context.service';
import { AppLogger } from './services/logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmailLog])],
  providers: [
    MailService,
    MailTransport,
    EmailQuota,
    RequestContextService,
    AppLogger,
  ],
  exports: [
    MailService,
    MailTransport,
    EmailQuota,
    RequestContextService,
    AppLogger,
  ],
  controllers: [],
})
export class CommonModule {}
