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
} from '@nestjs/common';
import { HideTreatmentPricesInterceptor } from 'src/common/interceptors/hide-treatment-prices.interceptor';
import { TreatmentsService } from './treatments.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('treatments')
@UseInterceptors(HideTreatmentPricesInterceptor)
export class TreatmentsController {
  constructor(private readonly treatmentsService: TreatmentsService) {}

  /** Flow F (standalone) — also handles Flow E when `encounterId` is in the body. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
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
  async catalog(@ActiveTenant() ctx: TenantContext) {
    const data = await this.treatmentsService.listProcedureCatalog(ctx);
    return ResponseWrapper.success(data, 'Procedure catalog retrieved');
  }

  /** List treatments for a patient or an encounter. */
  @Get()
  async findAll(
    @Query('patientId') patientId: string | undefined,
    @Query('encounterId') encounterId: string | undefined,
    @ActiveTenant() ctx: TenantContext,
  ) {
    if (encounterId) {
      const data = await this.treatmentsService.findByEncounter(encounterId, ctx);
      return ResponseWrapper.success(data, 'Treatments retrieved successfully');
    }
    if (patientId) {
      const data = await this.treatmentsService.findByPatient(patientId, ctx);
      return ResponseWrapper.success(data, 'Treatments retrieved successfully');
    }
    throw new BadRequestException('Provide either patientId or encounterId');
  }
}
