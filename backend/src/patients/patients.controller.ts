import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/request/create-patient.dto';
import { UpdatePatientDto } from './dto/request/update-patient.dto';
import { PatientQueryDto } from './dto/request/patient-query.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePatientDto) {
    const patient = await this.patientsService.create(dto);
    return ResponseWrapper.success(patient, 'Patient created successfully');
  }

  @Get()
  async findAll(@Query() query: PatientQueryDto) {
    const result = await this.patientsService.findAll(query);
    return ResponseWrapper.success(result, 'Patients retrieved successfully');
  }

  @Get('check-phone/:phone')
  async checkPhone(
    @Param('phone') phone: string,
    @Query('excludeId') excludeId?: string,
  ) {
    const result = await this.patientsService.checkPhoneExists(
      phone,
      excludeId,
    );
    return ResponseWrapper.success(result);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const patient = await this.patientsService.findOne(id);
    return ResponseWrapper.success(patient, 'Patient retrieved successfully');
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    const patient = await this.patientsService.update(id, dto);
    return ResponseWrapper.success(patient, 'Patient updated successfully');
  }

  @Patch(':id/deactivate')
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    const patient = await this.patientsService.deactivate(id);
    return ResponseWrapper.success(
      patient,
      'Patient deactivated successfully',
    );
  }
}
