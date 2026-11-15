import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { PatientContext, PatientCtx } from '../context/patient-context';
import { PatientApi } from '../decorators/patient-api.decorator';
import {
  DoseEventsQueryDto,
  MedicationsQueryDto,
  PatchMedicationDto,
  RecordDoseEventsDto,
} from './patient-medications.dto';
import { PatientMedicationsService } from './patient-medications.service';

/** Medicine schedules and dose events of the caller's profiles (M3-02). */
@Controller('patient-api/medications')
@PatientApi()
export class PatientMedicationsController {
  constructor(private readonly medications: PatientMedicationsService) {}

  @Get()
  async list(
    @PatientCtx() ctx: PatientContext,
    @Query() q: MedicationsQueryDto,
  ) {
    return ResponseWrapper.success(await this.medications.list(ctx, q));
  }

  // Declared before `:id` routes so "dose-events" is never read as an id.
  @Get('dose-events')
  async doseEvents(
    @PatientCtx() ctx: PatientContext,
    @Query() q: DoseEventsQueryDto,
  ) {
    return ResponseWrapper.success(await this.medications.listDoseEvents(ctx, q));
  }

  @Post('dose-events')
  async recordDoseEvents(
    @PatientCtx() ctx: PatientContext,
    @Body() body: RecordDoseEventsDto,
  ) {
    return ResponseWrapper.success(
      await this.medications.recordDoseEvents(ctx, body.events),
    );
  }

  @Patch(':id')
  async patch(
    @PatientCtx() ctx: PatientContext,
    @Param('id') id: string,
    @Body() body: PatchMedicationDto,
  ) {
    return ResponseWrapper.success(await this.medications.patch(ctx, id, body));
  }
}
