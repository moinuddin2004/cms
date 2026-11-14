import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { PatientContext, PatientCtx } from './context/patient-context';
import { PatientApi } from './decorators/patient-api.decorator';
import { UpdatePatientMeDto } from './dto/patient-me.dto';
import { PatientMeService } from './patient-me.service';

@Controller('patient-api/me')
@PatientApi()
export class PatientMeController {
  constructor(private readonly me: PatientMeService) {}

  @Get()
  async get(@PatientCtx() ctx: PatientContext) {
    return ResponseWrapper.success(await this.me.get(ctx));
  }

  @Patch()
  async update(
    @PatientCtx() ctx: PatientContext,
    @Body() dto: UpdatePatientMeDto,
  ) {
    return ResponseWrapper.success(
      await this.me.updateName(ctx, dto.fullName),
      'Profile updated',
    );
  }
}
