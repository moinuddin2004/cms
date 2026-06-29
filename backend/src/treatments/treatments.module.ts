import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Treatment } from './entities/treatment.entity';
import { PatientEncounter } from 'src/encounters/entities/patient-encounter.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { TreatmentsController } from './treatments.controller';
import { TreatmentsService } from './treatments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Treatment, PatientEncounter, Patient])],
  controllers: [TreatmentsController],
  providers: [TreatmentsService],
  exports: [TreatmentsService],
})
export class TreatmentsModule {}
