import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { HideTreatmentPricesInterceptor } from 'src/common/interceptors/hide-treatment-prices.interceptor';
import { EncountersService } from './encounters.service';
import { TreatmentsService } from 'src/treatments/treatments.service';
import { CreateEncounterTreatmentDto } from 'src/treatments/dto/create-encounter-treatment.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import type { AccessContext } from 'src/access/access-context';
import { Access, Can } from 'src/access/decorators/access.decorators';
import { UpdateEncounterNotesDto } from './dto/update-encounter-notes.dto';

/**
 * Consultation screen (`consultation.conduct`, scoped: a doctor with `own`
 * reaches only encounters from their own queue) plus the patient record's
 * encounter reads and treatment entry.
 */
@Controller('encounters')
@UseInterceptors(HideTreatmentPricesInterceptor)
export class EncountersController {
  constructor(
    private readonly encountersService: EncountersService,
    private readonly treatmentsService: TreatmentsService,
  ) {}

  /** Back into a consultation from a queue entry (doctor screen, after a reload). */
  @Can('consultation.conduct')
  @Get('by-queue-entry/:queueEntryId')
  async findByQueueEntry(
    @Param('queueEntryId', ParseUUIDPipe) queueEntryId: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    const data = await this.encountersService.getWorkspaceByQueueEntry(
      queueEntryId,
      ctx,
      access,
    );
    return ResponseWrapper.success(data, 'Consultation retrieved successfully');
  }

  /** The consultation screen's one-call load: encounter + queue entry + doctor. */
  @Can('consultation.conduct')
  @Get(':id/workspace')
  async workspace(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    await this.encountersService.assertConductScope(id, ctx, access);
    const data = await this.encountersService.getWorkspace(id, ctx);
    return ResponseWrapper.success(data, 'Consultation retrieved successfully');
  }

  /** Auto-save of the doctor's visit notes. */
  @Can('consultation.conduct')
  @Patch(':id')
  async updateNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEncounterNotesDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    await this.encountersService.assertConductScope(id, ctx, access);
    const data = await this.encountersService.updateNotes(
      id,
      ctx,
      dto,
      access.userId,
    );
    return ResponseWrapper.success(data, 'Notes saved');
  }

  /** Flow H — a single encounter with appointment, patient and treatments. */
  @Can('patients.clinical.view')
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.encountersService.findOne(id, ctx);
    return ResponseWrapper.success(data, 'Encounter retrieved successfully');
  }

  /** Flow E — add a treatment to this encounter (patient derived from the encounter). */
  @Can('patients.clinical.edit')
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
