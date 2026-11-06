import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { Can } from 'src/access/decorators/access.decorators';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import {
  OutboxLogQueryDto,
  TemplateQueryDto,
  UpdateAudienceSettingDto,
  UpdatePatientCommPrefsDto,
  UpdateRulesDto,
  UpsertTemplateDto,
} from '../dto/notifications.dto';
import type { NotificationAudience } from '../notifications.enums';
import { NotificationSettingsService } from '../services/notification-settings.service';

/**
 * Clinic notification settings (lab ERD §16): `notifications.settings.manage`,
 * except patient opt-outs, which reception records from the patient's
 * profile (`patients.view` / `patients.edit`).
 * Not behind the lab feature flag: notifications are cross-cutting.
 */
@Controller('notification-settings')
export class NotificationSettingsController {
  constructor(private readonly settings: NotificationSettingsService) {}

  /** Master switches, quiet hours and every event × channel rule (defaults filled in). */
  @Get()
  @Can('notifications.settings.manage')
  async overview(@ActiveTenant() t: TenantContext) {
    return ResponseWrapper.success(
      await this.settings.overview(t.organizationId),
    );
  }

  @Patch('audiences/:audience')
  @Can('notifications.settings.manage')
  async updateAudience(
    @ActiveTenant() t: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
    @Param('audience') audience: NotificationAudience,
    @Body() dto: UpdateAudienceSettingDto,
  ) {
    return ResponseWrapper.success(
      await this.settings.updateAudience(
        t.organizationId,
        actor,
        audience,
        dto,
      ),
      'Notification settings saved',
    );
  }

  /** Every event × channel back to the platform default. */
  @Post('rules/reset')
  @HttpCode(HttpStatus.OK)
  @Can('notifications.settings.manage')
  async resetRules(
    @ActiveTenant() t: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.settings.resetRules(t.organizationId, actor),
      'Notification rules reset to defaults',
    );
  }

  /** Sends a test email to the signed-in user (verified address only). */
  @Post('test-email')
  @RateLimit({ maxAttempts: 5, windowSeconds: 3600 })
  @HttpCode(HttpStatus.OK)
  @Can('notifications.settings.manage')
  async testEmail(
    @ActiveTenant() t: TenantContext,
    @CurrentUserId() userId: string,
  ) {
    const r = await this.settings.sendTestEmail(t.organizationId, userId);
    return ResponseWrapper.success(r, `Test email sent to ${r.to}`);
  }

  @Put('rules')
  @Can('notifications.settings.manage')
  async updateRules(
    @ActiveTenant() t: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
    @Body() dto: UpdateRulesDto,
  ) {
    return ResponseWrapper.success(
      await this.settings.updateRules(t.organizationId, actor, dto.rules),
      'Notification rules saved',
    );
  }

  @Get('templates')
  @Can('notifications.settings.manage')
  async templates(
    @ActiveTenant() t: TenantContext,
    @Query() q: TemplateQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.settings.templates(t.organizationId, q.eventCode),
    );
  }

  @Put('templates')
  @Can('notifications.settings.manage')
  async upsertTemplate(
    @ActiveTenant() t: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
    @Body() dto: UpsertTemplateDto,
  ) {
    return ResponseWrapper.success(
      await this.settings.upsertTemplate(t.organizationId, actor, dto),
      'Template saved',
    );
  }

  /** Back to the platform wording. */
  @Delete('templates/:id')
  @Can('notifications.settings.manage')
  @HttpCode(HttpStatus.OK)
  async resetTemplate(
    @ActiveTenant() t: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.settings.resetTemplate(t.organizationId, actor, id);
    return ResponseWrapper.success(null, 'Template reset to default');
  }

  @Get('log')
  @Can('notifications.settings.manage')
  async log(@ActiveTenant() t: TenantContext, @Query() q: OutboxLogQueryDto) {
    return ResponseWrapper.success(
      await this.settings.log(t.organizationId, q),
    );
  }

  @Get('patients/:patientId/prefs')
  @Can('patients.view')
  async patientPrefs(
    @ActiveTenant() t: TenantContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return ResponseWrapper.success(
      await this.settings.patientPrefs(t.organizationId, patientId),
    );
  }

  @Put('patients/:patientId/prefs')
  @Can('patients.edit')
  async updatePatientPrefs(
    @ActiveTenant() t: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: UpdatePatientCommPrefsDto,
  ) {
    return ResponseWrapper.success(
      await this.settings.updatePatientPrefs(
        t.organizationId,
        actor,
        patientId,
        dto,
      ),
      'Messaging preferences saved',
    );
  }
}
