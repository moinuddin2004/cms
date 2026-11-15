import { Controller, Get, Param, Query } from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { PatientContext, PatientCtx } from '../context/patient-context';
import { PatientApi } from '../decorators/patient-api.decorator';
import {
  AppointmentsQueryDto,
  PagedProfileQueryDto,
  ProfileFilterDto,
} from './patient-reads.dto';
import { PatientReadsService } from './patient-reads.service';

/** Read-only records of the caller's linked patients (M2-08). */
@Controller('patient-api')
@PatientApi()
export class PatientReadsController {
  constructor(private readonly reads: PatientReadsService) {}

  @Get('appointments')
  async appointments(
    @PatientCtx() ctx: PatientContext,
    @Query() q: AppointmentsQueryDto,
  ) {
    return ResponseWrapper.success(await this.reads.appointments(ctx, q));
  }

  @Get('visits')
  async visits(
    @PatientCtx() ctx: PatientContext,
    @Query() q: PagedProfileQueryDto,
  ) {
    return ResponseWrapper.success(await this.reads.visits(ctx, q));
  }

  @Get('prescriptions')
  async prescriptions(
    @PatientCtx() ctx: PatientContext,
    @Query() q: PagedProfileQueryDto,
  ) {
    return ResponseWrapper.success(await this.reads.prescriptions(ctx, q));
  }

  @Get('prescriptions/:id')
  async prescription(
    @PatientCtx() ctx: PatientContext,
    @Param('id') id: string,
  ) {
    return ResponseWrapper.success(await this.reads.prescription(ctx, id));
  }

  @Get('billing/summary')
  async billing(
    @PatientCtx() ctx: PatientContext,
    @Query() q: ProfileFilterDto,
  ) {
    return ResponseWrapper.success(await this.reads.billingSummary(ctx, q));
  }
}
