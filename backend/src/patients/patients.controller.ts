import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { AuditService } from 'src/common/audit/audit.service';
import { ActorSide, AuditAction } from 'src/common/audit/audit.enums';
import type { ActorRef } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { HideTreatmentPricesInterceptor } from 'src/common/interceptors/hide-treatment-prices.interceptor';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/request/create-patient.dto';
import {
  UpdatePatientDto,
  UpdatePatientStatusDto,
} from './dto/request/update-patient.dto';
import { PatientQueryDto } from './dto/request/patient-query.dto';
import {
  UpsertDentalInfoDto,
  CreateTeethChartDto,
  CreateVitalsDto,
  CreateTreatmentPlanDto,
  UpdateTreatmentPlanDto,
  CreatePlanItemDto,
  UpdatePlanItemDto,
  CreatePrescriptionDto,
  CreateDocumentDto,
  CreateConsentDto,
  CreateCommunicationDto,
  CreateRecallDto,
  UpdateRecallDto,
  CreateReferralDto,
  CreateFeedbackDto,
  CreateInsuranceDto,
  UpdateInsuranceDto,
} from './dto/request/sub-entity.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Access, Can } from 'src/access/decorators/access.decorators';
import type { AccessContext } from 'src/access/access-context';
import { PatientInScope } from './access/patient-scope';

/**
 * Every `:id` route is limited to patients inside the caller's
 * `patients.view` scope (doctor `own` / `location` / `org`): others are 404.
 */
@PatientInScope('id')
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // PATIENT CRUD
  // ═══════════════════════════════════════════════════════════

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Can('patients.create')
  async create(
    @Body() dto: CreatePatientDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.create(ctx, dto, actor);
    return ResponseWrapper.success(data, 'Patient created successfully');
  }

  @Get()
  @Can('patients.view')
  async findAll(
    @Query() query: PatientQueryDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    const data = await this.patientsService.findAll(
      ctx.organizationId,
      query,
      access,
    );
    return ResponseWrapper.success(data, 'Patients retrieved successfully');
  }

  /**
   * The (filtered) patient list as CSV — same filters and scope as
   * `GET /patients`, no paging. Patient data leaves the system, so every
   * export is written to `audit_logs`. Declared before `:id`.
   */
  @Get('export')
  @Can('patients.export')
  async export(
    @Query() query: PatientQueryDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
    @Res() res: Response,
  ) {
    const file = await this.patientsService.exportCsv(
      ctx.organizationId,
      query,
      access,
    );
    await this.audit.record(this.dataSource.manager, actor, {
      organizationId: ctx.organizationId,
      entityType: 'patient_export',
      entityId: ctx.locationId,
      action: AuditAction.EXPORT,
      after: {
        rows: file.rows,
        truncated: file.truncated,
        filters: { ...query, page: undefined, limit: undefined },
      },
    });
    const day = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="patients-${day}.csv"`,
      'Access-Control-Expose-Headers':
        'Content-Disposition, X-Export-Truncated',
      'X-Export-Truncated': String(file.truncated),
      'Cache-Control': 'no-store',
    });
    res.end(file.csv);
  }

  @Get('check-phone/:phone')
  @Can('patients.view')
  async checkPhone(
    @Param('phone') phone: string,
    @Query('excludeId') excludeId: string | undefined,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.checkPhoneExists(
      ctx.organizationId,
      phone,
      excludeId,
    );
    return ResponseWrapper.success(data);
  }

  @Get(':id')
  @Can('patients.view')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.findOne(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Patient retrieved successfully');
  }

  @Put(':id')
  @Can('patients.edit')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.update(
      id,
      ctx.organizationId,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Patient updated successfully');
  }

  @Patch(':id/status')
  @Can('patients.edit')
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientStatusDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.setActive(
      id,
      ctx.organizationId,
      dto.isActive,
      actor,
    );
    return ResponseWrapper.success(
      data,
      dto.isActive
        ? 'Patient activated successfully'
        : 'Patient deactivated successfully',
    );
  }

  @Delete(':id')
  @Can('patients.delete')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    await this.patientsService.remove(id, ctx.organizationId, actor);
    return ResponseWrapper.success(null, 'Patient deleted permanently');
  }

  // ═══════════════════════════════════════════════════════════
  // VISITS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/visits')
  @Can('patients.view')
  async getVisits(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getVisits(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  // ═══════════════════════════════════════════════════════════
  // FULL HISTORY (Flow G)
  // ═══════════════════════════════════════════════════════════

  @Get(':id/history')
  @UseInterceptors(HideTreatmentPricesInterceptor)
  @Can('patients.clinical.view')
  async getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getHistory(id, ctx);
    return ResponseWrapper.success(
      data,
      'Patient history retrieved successfully',
    );
  }

  // ═══════════════════════════════════════════════════════════
  // AUDIT TRAIL
  // ═══════════════════════════════════════════════════════════

  /** Every change to the patient and their records — who, what, when. */
  @Get(':id/audit-trail')
  @Can('admin.audit.view')
  async getAuditTrail(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    const data = await this.patientsService.getAuditTrail(
      id,
      ctx.organizationId,
      access,
    );
    return ResponseWrapper.success(data, 'Audit trail retrieved successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // DENTAL INFO
  // ═══════════════════════════════════════════════════════════

  @Get(':id/dental-info')
  @Can('patients.clinical.view')
  async getDentalInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getDentalInfo(
      id,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data);
  }

  @Post(':id/dental-info')
  @Can('patients.clinical.edit')
  async upsertDentalInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertDentalInfoDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.upsertDentalInfo(
      id,
      ctx,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Dental info saved successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // TEETH CHARTS (append-only — no PUT)
  // ═══════════════════════════════════════════════════════════

  @Get(':id/teeth-charts')
  @Can('patients.clinical.view')
  @RequireFeature('patients.teeth_chart')
  async getTeethCharts(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getTeethCharts(
      id,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data);
  }

  @Post(':id/teeth-charts')
  @HttpCode(HttpStatus.CREATED)
  @Can('patients.chart.edit')
  async createTeethChart(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTeethChartDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.createTeethChart(
      id,
      ctx,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Teeth chart recorded successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // VITALS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/vitals')
  @Can('patients.clinical.view')
  async getVitals(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getVitals(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/vitals')
  @HttpCode(HttpStatus.CREATED)
  @Can('patients.clinical.edit')
  async createVitals(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVitalsDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.createVitals(id, ctx, dto, actor);
    return ResponseWrapper.success(data, 'Vitals recorded successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // TREATMENT PLANS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/treatment-plans')
  @Can('patients.clinical.view')
  @RequireFeature('patients.treatment_plans')
  async getTreatmentPlans(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getTreatmentPlans(
      id,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data);
  }

  @Post(':id/treatment-plans')
  @HttpCode(HttpStatus.CREATED)
  @Can('plans.manage')
  async createTreatmentPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTreatmentPlanDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.createTreatmentPlan(
      id,
      ctx,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Treatment plan created successfully');
  }

  @Patch(':id/treatment-plans/:planId')
  @Can('plans.manage')
  async updateTreatmentPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdateTreatmentPlanDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.updateTreatmentPlan(
      id,
      planId,
      ctx.organizationId,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Treatment plan updated successfully');
  }

  // ─── Plan Items ─────────────────────────────────────────

  @Get(':id/treatment-plans/:planId/items')
  @Can('patients.clinical.view')
  @RequireFeature('patients.treatment_plans')
  async getPlanItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getPlanItems(
      id,
      planId,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data);
  }

  @Post(':id/treatment-plans/:planId/items')
  @HttpCode(HttpStatus.CREATED)
  @Can('plans.manage')
  async createPlanItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: CreatePlanItemDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.createPlanItem(
      id,
      planId,
      ctx,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Plan item added successfully');
  }

  @Patch(':id/treatment-plans/:planId/items/:itemId')
  @Can('plans.manage')
  async updatePlanItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdatePlanItemDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.updatePlanItem(
      id,
      planId,
      itemId,
      ctx.organizationId,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Plan item updated successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // PRESCRIPTIONS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/prescriptions')
  @Can('patients.clinical.view')
  @RequireFeature('patients.prescriptions')
  async getPrescriptions(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getPrescriptions(
      id,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data);
  }

  @Post(':id/prescriptions')
  @HttpCode(HttpStatus.CREATED)
  @Can('prescriptions.create')
  async createPrescription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePrescriptionDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.createPrescription(
      id,
      ctx,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Prescription created successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // DOCUMENTS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/documents')
  @Can('patients.documents.manage')
  async getDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getDocuments(
      id,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data);
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  @Can('patients.documents.manage')
  async createDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDocumentDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.createDocument(id, ctx, dto, actor);
    return ResponseWrapper.success(data, 'Document uploaded successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // CONSENTS (Immutable — POST + GET only, NO PUT/DELETE)
  // ═══════════════════════════════════════════════════════════

  @Get(':id/consents')
  @Can('patients.clinical.view')
  async getConsents(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getConsents(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/consents')
  @HttpCode(HttpStatus.CREATED)
  @Can('patients.clinical.edit')
  async createConsent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateConsentDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.createConsent(id, ctx, dto, actor);
    return ResponseWrapper.success(data, 'Consent recorded successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // COMMUNICATIONS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/communications')
  @Can('patients.view')
  async getCommunications(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getCommunications(
      id,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data);
  }

  @Post(':id/communications')
  @HttpCode(HttpStatus.CREATED)
  @Can('patients.edit')
  async createCommunication(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommunicationDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.createCommunication(
      id,
      ctx,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Communication logged successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // RECALLS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/recalls')
  @Can('patients.view')
  async getRecalls(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getRecalls(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/recalls')
  @HttpCode(HttpStatus.CREATED)
  @Can('patients.edit')
  async createRecall(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRecallDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.createRecall(id, ctx, dto, actor);
    return ResponseWrapper.success(data, 'Recall scheduled successfully');
  }

  @Patch(':id/recalls/:recallId')
  @Can('patients.edit')
  async updateRecall(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recallId', ParseUUIDPipe) recallId: string,
    @Body() dto: UpdateRecallDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.updateRecall(
      id,
      recallId,
      ctx.organizationId,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Recall updated successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // REFERRALS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/referrals')
  @Can('patients.view')
  async getReferrals(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getReferrals(
      id,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data);
  }

  @Post(':id/referrals')
  @HttpCode(HttpStatus.CREATED)
  @Can('patients.edit')
  async createReferral(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReferralDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.createReferral(
      id,
      ctx.organizationId,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Referral recorded successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // FEEDBACK
  // ═══════════════════════════════════════════════════════════

  @Get(':id/feedback')
  @Can('patients.view')
  async getFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getFeedback(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/feedback')
  @HttpCode(HttpStatus.CREATED)
  @Can('patients.edit')
  async createFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFeedbackDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.createFeedback(id, ctx, dto, actor);
    return ResponseWrapper.success(data, 'Feedback submitted successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // INSURANCE
  // ═══════════════════════════════════════════════════════════

  @Get(':id/insurance')
  @Can('patients.view')
  @RequireFeature('patients.insurance')
  async getInsurance(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getInsurance(
      id,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data);
  }

  @Post(':id/insurance')
  @HttpCode(HttpStatus.CREATED)
  @Can('patients.edit')
  @RequireFeature('patients.insurance')
  async createInsurance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInsuranceDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.createInsurance(
      id,
      ctx.organizationId,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Insurance added successfully');
  }

  @Patch(':id/insurance/:insuranceId')
  @Can('patients.edit')
  @RequireFeature('patients.insurance')
  async updateInsurance(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('insuranceId', ParseUUIDPipe) insuranceId: string,
    @Body() dto: UpdateInsuranceDto,
    @ActiveTenant() ctx: TenantContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const data = await this.patientsService.updateInsurance(
      id,
      insuranceId,
      ctx.organizationId,
      dto,
      actor,
    );
    return ResponseWrapper.success(data, 'Insurance updated successfully');
  }
}
