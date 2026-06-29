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
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/request/create-patient.dto';
import { UpdatePatientDto } from './dto/request/update-patient.dto';
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

@RequireFeature('patients.core')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  // ═══════════════════════════════════════════════════════════
  // PATIENT CRUD
  // ═══════════════════════════════════════════════════════════

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePatientDto, @ActiveTenant() ctx: TenantContext, @Req() req: any) {
    const data = await this.patientsService.create(ctx, dto, req.user?.uuid);
    return ResponseWrapper.success(data, 'Patient created successfully');
  }

  @Get()
  async findAll(@Query() query: PatientQueryDto, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.findAll(ctx.organizationId, query);
    return ResponseWrapper.success(data, 'Patients retrieved successfully');
  }

  @Get('check-phone/:phone')
  async checkPhone(
    @Param('phone') phone: string,
    @Query('excludeId') excludeId: string | undefined,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.checkPhoneExists(ctx.organizationId, phone, excludeId);
    return ResponseWrapper.success(data);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.findOne(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Patient retrieved successfully');
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Patient updated successfully');
  }

  @Delete(':id')
  async softDelete(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.softDelete(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Patient deleted successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // VISITS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/visits')
  async getVisits(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getVisits(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  // ═══════════════════════════════════════════════════════════
  // FULL HISTORY (Flow G)
  // ═══════════════════════════════════════════════════════════

  @Get(':id/history')
  async getHistory(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getHistory(id, ctx);
    return ResponseWrapper.success(data, 'Patient history retrieved successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // DENTAL INFO
  // ═══════════════════════════════════════════════════════════

  @Get(':id/dental-info')
  async getDentalInfo(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getDentalInfo(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/dental-info')
  async upsertDentalInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertDentalInfoDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.upsertDentalInfo(id, ctx, dto);
    return ResponseWrapper.success(data, 'Dental info saved successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // TEETH CHARTS (append-only — no PUT)
  // ═══════════════════════════════════════════════════════════

  @Get(':id/teeth-charts')
  async getTeethCharts(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getTeethCharts(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/teeth-charts')
  @HttpCode(HttpStatus.CREATED)
  async createTeethChart(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTeethChartDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.createTeethChart(id, ctx, dto);
    return ResponseWrapper.success(data, 'Teeth chart recorded successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // VITALS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/vitals')
  async getVitals(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getVitals(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/vitals')
  @HttpCode(HttpStatus.CREATED)
  async createVitals(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVitalsDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.createVitals(id, ctx, dto);
    return ResponseWrapper.success(data, 'Vitals recorded successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // TREATMENT PLANS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/treatment-plans')
  async getTreatmentPlans(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getTreatmentPlans(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/treatment-plans')
  @HttpCode(HttpStatus.CREATED)
  async createTreatmentPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTreatmentPlanDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.patientsService.createTreatmentPlan(id, ctx, dto, req.user?.uuid);
    return ResponseWrapper.success(data, 'Treatment plan created successfully');
  }

  @Patch(':id/treatment-plans/:planId')
  async updateTreatmentPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdateTreatmentPlanDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.updateTreatmentPlan(id, planId, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Treatment plan updated successfully');
  }

  // ─── Plan Items ─────────────────────────────────────────

  @Get(':id/treatment-plans/:planId/items')
  async getPlanItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.getPlanItems(id, planId, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/treatment-plans/:planId/items')
  @HttpCode(HttpStatus.CREATED)
  async createPlanItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: CreatePlanItemDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.createPlanItem(id, planId, ctx, dto);
    return ResponseWrapper.success(data, 'Plan item added successfully');
  }

  @Patch(':id/treatment-plans/:planId/items/:itemId')
  async updatePlanItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdatePlanItemDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.updatePlanItem(
      id,
      planId,
      itemId,
      ctx.organizationId,
      dto,
    );
    return ResponseWrapper.success(data, 'Plan item updated successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // PRESCRIPTIONS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/prescriptions')
  async getPrescriptions(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getPrescriptions(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/prescriptions')
  @HttpCode(HttpStatus.CREATED)
  async createPrescription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePrescriptionDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.createPrescription(id, ctx, dto);
    return ResponseWrapper.success(data, 'Prescription created successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // DOCUMENTS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/documents')
  async getDocuments(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getDocuments(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  async createDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDocumentDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.createDocument(id, ctx, dto);
    return ResponseWrapper.success(data, 'Document uploaded successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // CONSENTS (Immutable — POST + GET only, NO PUT/DELETE)
  // ═══════════════════════════════════════════════════════════

  @Get(':id/consents')
  async getConsents(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getConsents(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/consents')
  @HttpCode(HttpStatus.CREATED)
  async createConsent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateConsentDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.createConsent(id, ctx, dto);
    return ResponseWrapper.success(data, 'Consent recorded successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // COMMUNICATIONS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/communications')
  async getCommunications(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getCommunications(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/communications')
  @HttpCode(HttpStatus.CREATED)
  async createCommunication(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommunicationDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.createCommunication(id, ctx, dto);
    return ResponseWrapper.success(data, 'Communication logged successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // RECALLS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/recalls')
  async getRecalls(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getRecalls(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/recalls')
  @HttpCode(HttpStatus.CREATED)
  async createRecall(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRecallDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.patientsService.createRecall(id, ctx, dto, req.user?.uuid);
    return ResponseWrapper.success(data, 'Recall scheduled successfully');
  }

  @Patch(':id/recalls/:recallId')
  async updateRecall(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recallId', ParseUUIDPipe) recallId: string,
    @Body() dto: UpdateRecallDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.updateRecall(id, recallId, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Recall updated successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // REFERRALS
  // ═══════════════════════════════════════════════════════════

  @Get(':id/referrals')
  async getReferrals(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getReferrals(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/referrals')
  @HttpCode(HttpStatus.CREATED)
  async createReferral(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReferralDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.createReferral(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Referral recorded successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // FEEDBACK
  // ═══════════════════════════════════════════════════════════

  @Get(':id/feedback')
  async getFeedback(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getFeedback(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/feedback')
  @HttpCode(HttpStatus.CREATED)
  async createFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFeedbackDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.createFeedback(id, ctx, dto);
    return ResponseWrapper.success(data, 'Feedback submitted successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // INSURANCE
  // ═══════════════════════════════════════════════════════════

  @Get(':id/insurance')
  async getInsurance(@Param('id', ParseUUIDPipe) id: string, @ActiveTenant() ctx: TenantContext) {
    const data = await this.patientsService.getInsurance(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Post(':id/insurance')
  @HttpCode(HttpStatus.CREATED)
  async createInsurance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInsuranceDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.createInsurance(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Insurance added successfully');
  }

  @Patch(':id/insurance/:insuranceId')
  async updateInsurance(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('insuranceId', ParseUUIDPipe) insuranceId: string,
    @Body() dto: UpdateInsuranceDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.patientsService.updateInsurance(id, insuranceId, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Insurance updated successfully');
  }
}
