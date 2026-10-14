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
} from '@nestjs/common';
import { EncountersService } from './encounters.service';
import { TreatmentsService } from 'src/treatments/treatments.service';
import { CreateEncounterTreatmentDto } from 'src/treatments/dto/create-encounter-treatment.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { CurrentActor, Roles } from 'src/common/decorators/roles.decorator';
import { Actor, AppRole } from 'src/common/enums/app-role.enum';
import { UpdateEncounterNotesDto } from './dto/update-encounter-notes.dto';

@Controller('encounters')
export class EncountersController {
  constructor(
    private readonly encountersService: EncountersService,
    private readonly treatmentsService: TreatmentsService,
  ) {}

  /** Back into a consultation from a queue entry (doctor screen, after a reload). */
  @Get('by-queue-entry/:queueEntryId')
  async findByQueueEntry(
    @Param('queueEntryId', ParseUUIDPipe) queueEntryId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.encountersService.getWorkspaceByQueueEntry(
      queueEntryId,
      ctx,
    );
    return ResponseWrapper.success(data, 'Consultation retrieved successfully');
  }

  /** The consultation screen's one-call load: encounter + queue entry + doctor. */
  @Get(':id/workspace')
  async workspace(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.encountersService.getWorkspace(id, ctx);
    return ResponseWrapper.success(data, 'Consultation retrieved successfully');
  }

  /** Auto-save of the doctor's visit notes. */
  @Roles(AppRole.DOCTOR, AppRole.CLINIC_ADMIN)
  @Patch(':id')
  async updateNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEncounterNotesDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
  ) {
    const data = await this.encountersService.updateNotes(
      id,
      ctx,
      dto,
      actor.userId,
    );
    return ResponseWrapper.success(data, 'Notes saved');
  }

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
