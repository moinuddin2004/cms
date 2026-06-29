import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientEncounter } from './entities/patient-encounter.entity';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { TreatmentsModule } from 'src/treatments/treatments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PatientEncounter]),
    TreatmentsModule,
  ],
  controllers: [EncountersController],
  providers: [EncountersService],
  exports: [EncountersService],
})
export class EncountersModule {}
