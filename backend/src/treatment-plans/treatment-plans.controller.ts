import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Access, Can } from 'src/access/decorators/access.decorators';
import type { AccessContext } from 'src/access/access-context';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActorSide } from 'src/common/audit/audit.enums';
import type { ActorRef } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PatientInScope } from 'src/patients/access/patient-scope';
import {
  CreateTreatmentPlanDto,
  PlanDiscountDto,
  PlanSessionDto,
  UpdateTreatmentPlanDto,
} from './dto/treatment-plan.dto';
import { TreatmentPlansService } from './treatment-plans.service';

/** A patient's treatment plans (services, one discount, one invoice). */
@RequireFeature('patients.treatment_plans')
@Controller('patients/:patientId/treatment-plans')
export class TreatmentPlansController {
  constructor(private readonly service: TreatmentPlansService) {}

  @Get()
  @Can('patients.clinical.view')
  @PatientInScope('patientId')
  async list(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    return ResponseWrapper.success(await this.service.list(patientId, ctx));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Can('plans.manage')
  @PatientInScope('patientId')
  async create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateTreatmentPlanDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.service.create(patientId, ctx, access, dto, actor);
    return ResponseWrapper.success(data, 'Treatment plan created');
  }

  @Patch(':planId')
  @Can('plans.manage')
  @PatientInScope('patientId')
  async update(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdateTreatmentPlanDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.service.update(
      patientId,
      planId,
      ctx,
      access,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Treatment plan updated');
  }

  /** Reception sets the plan discount before treatment starts. */
  @Patch(':planId/discount')
  @Can('billing.discount.apply', 'patients.price.view')
  @PatientInScope('patientId')
  async setDiscount(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: PlanDiscountDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.service.setDiscount(
      patientId,
      planId,
      ctx,
      access,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Discount saved');
  }

  @Post(':planId/accept')
  @HttpCode(HttpStatus.OK)
  @Can('plans.manage')
  @PatientInScope('patientId')
  async accept(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.service.accept(patientId, planId, ctx, actor);
    return ResponseWrapper.success(data, 'Plan accepted');
  }

  @Post(':planId/items/:itemId/session')
  @HttpCode(HttpStatus.OK)
  @Can('plans.manage')
  @PatientInScope('patientId')
  async session(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: PlanSessionDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.service.session(
      patientId,
      planId,
      itemId,
      ctx,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Session recorded');
  }

  @Post(':planId/cancel')
  @HttpCode(HttpStatus.OK)
  @Can('plans.manage')
  @PatientInScope('patientId')
  async cancel(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.service.cancel(patientId, planId, ctx, actor);
    return ResponseWrapper.success(data, 'Plan cancelled');
  }
}
