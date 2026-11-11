import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { PatientApi } from './decorators/patient-api.decorator';
import { UpdatePatientMeDto } from './dto/patient-me.dto';
import type { PatientRequest } from './guards/patient-link.guard';
import { PatientMeService } from './patient-me.service';

@Controller('patient-api/me')
@PatientApi()
export class PatientMeController {
  constructor(private readonly me: PatientMeService) {}

  @Get()
  async get(@Req() req: PatientRequest) {
    return ResponseWrapper.success(await this.me.get(req.patientContext!));
  }

  @Patch()
  async update(@Req() req: PatientRequest, @Body() dto: UpdatePatientMeDto) {
    return ResponseWrapper.success(
      await this.me.updateName(req.patientContext!, dto.fullName),
      'Profile updated',
    );
  }
}
