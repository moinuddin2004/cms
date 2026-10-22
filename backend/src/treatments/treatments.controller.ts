import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HideTreatmentPricesInterceptor } from 'src/common/interceptors/hide-treatment-prices.interceptor';
import { TreatmentsService } from './treatments.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Access, Can } from 'src/access/decorators/access.decorators';
import type { AccessContext } from 'src/access/access-context';
import {
  isPatientInScope,
  PatientInScope,
} from 'src/patients/access/patient-scope';

@Controller('treatments')
@UseInterceptors(HideTreatmentPricesInterceptor)
export class TreatmentsController {
  constructor(
    private readonly treatmentsService: TreatmentsService,
    private readonly dataSource: DataSource,
  ) {}

  /** Flow F (standalone) — also handles Flow E when `encounterId` is in the body. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Can('patients.clinical.edit')
  async create(
    @Body() dto: CreateTreatmentDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.treatmentsService.create(ctx, dto, req.user?.uuid);
    return ResponseWrapper.success(data, 'Treatment recorded successfully');
  }

  /** Procedures the doctor can pick (id + name only — no prices). */
  @Get('catalog')
  @Can('patients.clinical.view')
  async catalog(@ActiveTenant() ctx: TenantContext) {
    const data = await this.treatmentsService.listProcedureCatalog(ctx);
    return ResponseWrapper.success(data, 'Procedure catalog retrieved');
  }

  /** List treatments for a patient or an encounter. */
  @Get()
  @Can('patients.clinical.view')
  @PatientInScope('patientId', 'query')
  async findAll(
    @Query('patientId') patientId: string | undefined,
    @Query('encounterId') encounterId: string | undefined,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    if (encounterId) {
      const data = await this.treatmentsService.findByEncounter(
        encounterId,
        ctx,
      );
      // One encounter = one patient: out of scope → as if it did not exist.
      if (
        data.length &&
        !(await isPatientInScope(this.dataSource, access, data[0].patientId))
      ) {
        throw new NotFoundException('Encounter not found');
      }
      return ResponseWrapper.success(data, 'Treatments retrieved successfully');
    }
    if (patientId) {
      const data = await this.treatmentsService.findByPatient(patientId, ctx);
      return ResponseWrapper.success(data, 'Treatments retrieved successfully');
    }
    throw new BadRequestException('Provide either patientId or encounterId');
  }
}
