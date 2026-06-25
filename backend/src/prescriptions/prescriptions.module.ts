import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicineDirectory } from './entities/medicine-directory.entity';
import { PrescriptionTemplate } from './entities/prescription-template.entity';
import { TreatmentPlanTemplate } from './entities/treatment-plan-template.entity';
import { TreatmentPlanTemplateMedicine } from './entities/treatment-plan-template-medicine.entity';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionMedicine } from './entities/prescription-medicine.entity';
import { DoctorSignature } from './entities/doctor-signature.entity';
import { PrescriptionHistory } from './entities/prescription-history.entity';

import { MedicineDirectoryService } from './services/medicine-directory.service';
import { PrescriptionTemplateService } from './services/prescription-template.service';
import { TreatmentPlanTemplateService } from './services/treatment-plan-template.service';
import { DoctorSignatureService } from './services/doctor-signature.service';
import { PrescriptionService } from './services/prescription.service';
import { PrescriptionPdfService } from './services/prescription-pdf.service';
import { PrescriptionHistoryService } from './services/prescription-history.service';

import { MedicineDirectoryController } from './controllers/medicine-directory.controller';
import { PrescriptionTemplateController } from './controllers/prescription-template.controller';
import { TreatmentPlanTemplateController } from './controllers/treatment-plan-template.controller';
import { DoctorSignatureController } from './controllers/doctor-signature.controller';
import { PrescriptionController } from './controllers/prescription.controller';

import { StorageModule } from 'src/common/storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicineDirectory,
      PrescriptionTemplate,
      TreatmentPlanTemplate,
      TreatmentPlanTemplateMedicine,
      Prescription,
      PrescriptionMedicine,
      DoctorSignature,
      PrescriptionHistory,
    ]),
    StorageModule,
  ],
  controllers: [
    MedicineDirectoryController,
    PrescriptionTemplateController,
    TreatmentPlanTemplateController,
    DoctorSignatureController,
    PrescriptionController,
  ],
  providers: [
    MedicineDirectoryService,
    PrescriptionTemplateService,
    TreatmentPlanTemplateService,
    DoctorSignatureService,
    PrescriptionService,
    PrescriptionPdfService,
    PrescriptionHistoryService,
  ],
  exports: [PrescriptionService, MedicineDirectoryService],
})
export class PrescriptionsModule {}
