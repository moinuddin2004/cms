import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Can } from 'src/access/decorators/access.decorators';
import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PatientInScope } from 'src/patients/access/patient-scope';
import { RevokeAppLinkDto } from './dto/patient-links.dto';
import { PatientLinksService } from './patient-links.service';

/** Staff endpoints of the patient app link (07 §4.1). */
@Controller('patients/:patientId/app-link')
export class PatientLinksController {
  constructor(private readonly links: PatientLinksService) {}

  @Post('claim-token')
  @PatientInScope('patientId', 'param', 'patients.app_link.manage')
  @HttpCode(HttpStatus.CREATED)
  @Can('patients.app_link.manage')
  @RequireFeature('patient_app')
  @RateLimit({ maxAttempts: 30, windowSeconds: 600 })
  async createClaimToken(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.links.createClaimToken(
      ctx.organizationId,
      patientId,
      actor,
    );
    return ResponseWrapper.success(data, 'Claim token created');
  }

  @Get()
  @PatientInScope('patientId')
  @Can('patients.view')
  @RequireFeature('patient_app')
  async status(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    return ResponseWrapper.success(
      await this.links.status(ctx.organizationId, patientId),
    );
  }

  /** Always allowed with `patients.app_link.manage`, even when the clinic switched `patient_app` off (audit M3). */
  @Delete()
  @PatientInScope('patientId', 'param', 'patients.app_link.manage')
  @Can('patients.app_link.manage')
  async revoke(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: RevokeAppLinkDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.links.revoke(ctx.organizationId, patientId, dto.reason, actor),
      'App link revoked',
    );
  }
}
