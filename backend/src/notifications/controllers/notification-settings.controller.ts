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
  Put,
  Query,
} from '@nestjs/common';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { AppRole } from 'src/common/enums/app-role.enum';
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
 * Clinic notification settings (lab ERD §16). Clinic admins only, except
 * patient opt-outs, which reception records from the patient's profile.
 * Not behind the lab feature flag: notifications are cross-cutting.
 */
@Controller('notification-settings')
@Roles(AppRole.CLINIC_ADMIN)
export class NotificationSettingsController {
  constructor(private readonly settings: NotificationSettingsService) {}

  /** Master switches, quiet hours and every event × channel rule (defaults filled in). */
  @Get()
  async overview(@ActiveTenant() t: TenantContext) {
    return ResponseWrapper.success(
      await this.settings.overview(t.organizationId),
    );
  }

  @Patch('audiences/:audience')
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

  @Put('rules')
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
  async templates(
    @ActiveTenant() t: TenantContext,
    @Query() q: TemplateQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.settings.templates(t.organizationId, q.eventCode),
    );
  }

  @Put('templates')
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
  async log(@ActiveTenant() t: TenantContext, @Query() q: OutboxLogQueryDto) {
    return ResponseWrapper.success(
      await this.settings.log(t.organizationId, q),
    );
  }

  @Get('patients/:patientId/prefs')
  @Roles(AppRole.CLINIC_ADMIN, AppRole.RECEPTIONIST)
  async patientPrefs(
    @ActiveTenant() t: TenantContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return ResponseWrapper.success(
      await this.settings.patientPrefs(t.organizationId, patientId),
    );
  }

  @Put('patients/:patientId/prefs')
  @Roles(AppRole.CLINIC_ADMIN, AppRole.RECEPTIONIST)
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
