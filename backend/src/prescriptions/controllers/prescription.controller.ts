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
} from '@nestjs/common';
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

@RequireFeature('patients.prescriptions')
@Controller('prescriptions')
export class PrescriptionController {
  constructor(
    private readonly service: PrescriptionService,
    private readonly pdfService: PrescriptionPdfService,
    private readonly historyService: PrescriptionHistoryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePrescriptionDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.create(ctx, dto, dto.doctorId ?? null);
    return ResponseWrapper.success(data, 'Prescription created');
  }

  @Get()
  async findAll(
    @Query() filters: PrescriptionFilterDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.findAll(ctx, filters);
    return ResponseWrapper.success(data);
  }

  @Get('stats')
  async stats(@ActiveTenant() ctx: TenantContext) {
    const data = await this.service.getStats(ctx);
    return ResponseWrapper.success(data);
  }

  @Get('patient/:patientId')
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

  @Get('appointment/:appointmentId')
  async byAppointment(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.listByAppointment(
      appointmentId,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.findOne(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrescriptionDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
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
  async addMedicine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMedicineDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.service.addMedicine(
      id,
      ctx.organizationId,
      dto,
      req.user.uuid,
    );
    return ResponseWrapper.success(data, 'Medicine added');
  }

  @Patch(':id/medicines/:medicineId')
  async updateMedicine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('medicineId', ParseUUIDPipe) medicineId: string,
    @Body() dto: PrescriptionMedicineDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
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
  async removeMedicine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('medicineId', ParseUUIDPipe) medicineId: string,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
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
  async finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FinalizePrescriptionDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
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
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.service.duplicate(id, ctx, req.user.uuid);
    return ResponseWrapper.success(data, 'Prescription duplicated');
  }

  /** Stream the PDF inline. Regenerates on demand when no cached URL exists. */
  @Get(':id/pdf')
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Res() res: Response,
  ) {
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
  async history(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.historyService.listFor(id);
    return ResponseWrapper.success(data);
  }
}
