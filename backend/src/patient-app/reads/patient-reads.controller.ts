import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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

  /** PDF streamed through the API; no storage URL is ever returned. */
  @Get('prescriptions/:id/pdf')
  async prescriptionPdf(
    @PatientCtx() ctx: PatientContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.reads.prescriptionPdf(ctx, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, no-store',
    });
    res.end(buffer);
  }

  @Get('billing/summary')
  async billing(
    @PatientCtx() ctx: PatientContext,
    @Query() q: ProfileFilterDto,
  ) {
    return ResponseWrapper.success(await this.reads.billingSummary(ctx, q));
  }
}
