import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EncountersService } from './encounters.service';
import { TreatmentsService } from 'src/treatments/treatments.service';
import { CreateEncounterTreatmentDto } from 'src/treatments/dto/create-encounter-treatment.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('encounters')
export class EncountersController {
  constructor(
    private readonly encountersService: EncountersService,
    private readonly treatmentsService: TreatmentsService,
  ) {}

  /** Flow H — a single encounter with appointment, patient and treatments. */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.encountersService.findOne(id, ctx);
    return ResponseWrapper.success(data, 'Encounter retrieved successfully');
  }

  /** Flow E — add a treatment to this encounter (patient derived from the encounter). */
  @Post(':encounterId/treatments')
  @HttpCode(HttpStatus.CREATED)
  async addTreatment(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @Body() dto: CreateEncounterTreatmentDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.treatmentsService.createForEncounter(
      ctx,
      encounterId,
      dto,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Treatment recorded successfully');
  }
}
