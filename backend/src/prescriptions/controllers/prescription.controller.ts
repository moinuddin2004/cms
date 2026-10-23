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
  Query,
  Req,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Response } from 'express';
import { PrescriptionService } from '../services/prescription.service';
import { PrescriptionPdfService } from '../services/prescription-pdf.service';
import { PrescriptionHistoryService } from '../services/prescription-history.service';
import {
  AddMedicineDto,
  CreatePrescriptionDto,
  FinalizePrescriptionDto,
  PrescriptionFilterDto,
  PrescriptionMedicineDto,
  UpdatePrescriptionDto,
} from '../dto/prescription.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Access, Can } from 'src/access/decorators/access.decorators';
import type { AccessContext } from 'src/access/access-context';
import {
  isPatientInScope,
  PatientInScope,
} from 'src/patients/access/patient-scope';
import { Prescription } from '../entities/prescription.entity';

/**
 * Writing is `prescriptions.create`; reading is clinical (`patients.clinical.view`,
 * which does not imply this feature — hence the class-level feature check).
 * Every read and write is limited to patients inside the caller's
 * `patients.view` scope: others answer 404.
 */
@RequireFeature('patients.prescriptions')
@Controller('prescriptions')
export class PrescriptionController {
  constructor(
    private readonly service: PrescriptionService,
    private readonly pdfService: PrescriptionPdfService,
    private readonly historyService: PrescriptionHistoryService,
    private readonly dataSource: DataSource,
  ) {}

  /** 404 unless the prescription exists in the org and its patient is in scope. */
  private async ensureVisible(
    id: string,
    organizationId: string,
    access: AccessContext,
  ): Promise<void> {
    const row = await this.dataSource.getRepository(Prescription).findOne({
      where: { id, organizationId },
      select: { id: true, patientId: true },
    });
    if (
      !row ||
      !(await isPatientInScope(this.dataSource, access, row.patientId))
    ) {
      throw new NotFoundException('Prescription not found');
    }
  }

  /** Drops prescriptions whose patient is outside the caller's scope. */
  private async visibleOnly(
    rows: Prescription[],
    access: AccessContext,
  ): Promise<Prescription[]> {
    const ok = new Map<string, boolean>();
    for (const id of new Set(rows.map((r) => r.patientId))) {
      ok.set(id, await isPatientInScope(this.dataSource, access, id));
    }
    return rows.filter((r) => ok.get(r.patientId));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Can('prescriptions.create')
  async create(
    @Body() dto: CreatePrescriptionDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.create(ctx, dto, dto.doctorId ?? null);
    return ResponseWrapper.success(data, 'Prescription created');
  }

  @Get()
  @Can('patients.clinical.view')
  async findAll(
    @Query() filters: PrescriptionFilterDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    const data = await this.service.findAll(ctx, filters, access);
    return ResponseWrapper.success(data);
  }

  @Get('stats')
  @Can('patients.clinical.view')
  async stats(
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    const data = await this.service.getStats(ctx, access);
    return ResponseWrapper.success(data);
  }

  @Get('patient/:patientId')
  @Can('patients.clinical.view')
  @PatientInScope('patientId')
  async byPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.listByPatient(
      patientId,
      ctx.organizationId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return ResponseWrapper.success(data);
  }

  @Get('encounter/:encounterId')
  @Can('patients.clinical.view')
  async byEncounter(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    const data = await this.service.listByEncounter(
      encounterId,
      ctx.organizationId,
    );
    return ResponseWrapper.success(await this.visibleOnly(data, access));
  }

  @Get('appointment/:appointmentId')
  @Can('patients.clinical.view')
  async byAppointment(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    const data = await this.service.listByAppointment(
      appointmentId,
      ctx.organizationId,
    );
    return ResponseWrapper.success(await this.visibleOnly(data, access));
  }

  @Get(':id')
  @Can('patients.clinical.view')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    await this.ensureVisible(id, ctx.organizationId, access);
    const data = await this.service.findOne(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Patch(':id')
  @Can('prescriptions.create')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrescriptionDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
    @Access() access: AccessContext,
  ) {
    await this.ensureVisible(id, ctx.organizationId, access);
    const data = await this.service.update(
      id,
      ctx.organizationId,
      dto,
      req.user.uuid,
    );
    return ResponseWrapper.success(data, 'Prescription updated');
  }

  @Post(':id/medicines')
  @HttpCode(HttpStatus.CREATED)
  @Can('prescriptions.create')
  async addMedicine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMedicineDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
    @Access() access: AccessContext,
  ) {
    await this.ensureVisible(id, ctx.organizationId, access);
    const data = await this.service.addMedicine(
      id,
      ctx.organizationId,
      dto,
      req.user.uuid,
    );
    return ResponseWrapper.success(data, 'Medicine added');
  }

  @Patch(':id/medicines/:medicineId')
  @Can('prescriptions.create')
  async updateMedicine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('medicineId', ParseUUIDPipe) medicineId: string,
    @Body() dto: PrescriptionMedicineDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
    @Access() access: AccessContext,
  ) {
    await this.ensureVisible(id, ctx.organizationId, access);
    const data = await this.service.updateMedicine(
      id,
      medicineId,
      ctx.organizationId,
      dto,
      req.user.uuid,
    );
    return ResponseWrapper.success(data, 'Medicine updated');
  }

  @Delete(':id/medicines/:medicineId')
  @Can('prescriptions.create')
  async removeMedicine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('medicineId', ParseUUIDPipe) medicineId: string,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
    @Access() access: AccessContext,
  ) {
    await this.ensureVisible(id, ctx.organizationId, access);
    const data = await this.service.removeMedicine(
      id,
      medicineId,
      ctx.organizationId,
      req.user.uuid,
    );
    return ResponseWrapper.success(data, 'Medicine removed');
  }

  @Post(':id/finalize')
  @HttpCode(HttpStatus.OK)
  @Can('prescriptions.create')
  async finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FinalizePrescriptionDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
    @Access() access: AccessContext,
  ) {
    await this.ensureVisible(id, ctx.organizationId, access);
    const data = await this.service.finalize(
      id,
      ctx.organizationId,
      dto,
      req.user.uuid,
    );
    return ResponseWrapper.success(data, 'Prescription finalized');
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @Can('prescriptions.create')
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
    @Access() access: AccessContext,
  ) {
    await this.ensureVisible(id, ctx.organizationId, access);
    const data = await this.service.duplicate(id, ctx, req.user.uuid);
    return ResponseWrapper.success(data, 'Prescription duplicated');
  }

  /** Stream the PDF inline. Regenerates on demand when no cached URL exists. */
  @Get(':id/pdf')
  @Can('patients.clinical.view')
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Res() res: Response,
    @Access() access: AccessContext,
  ) {
    await this.ensureVisible(id, ctx.organizationId, access);
    const buffer = await this.pdfService.generatePdfBuffer(
      id,
      ctx.organizationId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="prescription-${id}.pdf"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @Get(':id/history')
  @Can('patients.clinical.view')
  async history(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    await this.ensureVisible(id, ctx.organizationId, access);
    const data = await this.historyService.listFor(id);
    return ResponseWrapper.success(data);
  }
}
