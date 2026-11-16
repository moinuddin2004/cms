import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { PatientContext, PatientCtx } from '../context/patient-context';
import { PatientApi } from '../decorators/patient-api.decorator';
import { CreateProfileDto, UpdateProfileDto } from './patient-profiles.dto';
import { PatientProfilesService } from './patient-profiles.service';

/** The account's own + family profiles (M2-10, P-04). */
@Controller('patient-api/profiles')
@PatientApi()
export class PatientProfilesController {
  constructor(private readonly profiles: PatientProfilesService) {}

  @Get()
  async list(@PatientCtx() ctx: PatientContext) {
    return ResponseWrapper.success(await this.profiles.list(ctx));
  }

  @Post()
  async create(
    @PatientCtx() ctx: PatientContext,
    @Body() dto: CreateProfileDto,
  ) {
    return ResponseWrapper.success(
      await this.profiles.create(ctx, dto),
      'Family member added',
    );
  }

  @Patch(':id')
  async update(
    @PatientCtx() ctx: PatientContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return ResponseWrapper.success(
      await this.profiles.update(ctx, id, dto),
      'Profile updated',
    );
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @PatientCtx() ctx: PatientContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.profiles.remove(ctx, id),
      'Family member removed',
    );
  }
}
