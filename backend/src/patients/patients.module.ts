import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { CommonModule } from 'src/common/common.module';

// Entities
import { Patient } from './entities/patient.entity';
import { PatientVisit } from './entities/patient-visit.entity';
import { PatientDentalInfo } from './entities/patient-dental-info.entity';
import { PatientTeethChart } from './entities/patient-teeth-chart.entity';
import { PatientVitals } from './entities/patient-vitals.entity';
import { PatientTreatmentPlan } from './entities/patient-treatment-plan.entity';
import { TreatmentPlanItem } from './entities/treatment-plan-item.entity';
import { PatientPrescription } from './entities/patient-prescription.entity';
import { PatientDocument } from './entities/patient-document.entity';
import { PatientConsent } from './entities/patient-consent.entity';
import { PatientCommunication } from './entities/patient-communication.entity';
import { PatientRecall } from './entities/patient-recall.entity';
import { PatientReferral } from './entities/patient-referral.entity';
import { PatientFeedback } from './entities/patient-feedback.entity';
import { PatientInsurance } from './entities/patient-insurance.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { EncountersModule } from 'src/encounters/encounters.module';
import { TreatmentsModule } from 'src/treatments/treatments.module';

@Module({
  imports: [
    CommonModule,
    EncountersModule,
    TreatmentsModule,
    TypeOrmModule.forFeature([
      Patient,
      PatientVisit,
      PatientDentalInfo,
      PatientTeethChart,
      PatientVitals,
      PatientTreatmentPlan,
      TreatmentPlanItem,
      PatientPrescription,
      PatientDocument,
      PatientConsent,
      PatientCommunication,
      PatientRecall,
      PatientReferral,
      PatientFeedback,
      PatientInsurance,
      Appointment,
    ]),
  ],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
