import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicineDirectory } from './entities/medicine-directory.entity';
import { PrescriptionTemplate } from './entities/prescription-template.entity';
import { PrescriptionPreset } from './entities/prescription-preset.entity';
import { PrescriptionPresetMedicine } from './entities/prescription-preset-medicine.entity';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionMedicine } from './entities/prescription-medicine.entity';
import { DoctorSignature } from './entities/doctor-signature.entity';
import { PrescriptionHistory } from './entities/prescription-history.entity';

import { MedicineDirectoryService } from './services/medicine-directory.service';
import { PrescriptionTemplateService } from './services/prescription-template.service';
import { PrescriptionPresetService } from './services/prescription-preset.service';
import { DoctorSignatureService } from './services/doctor-signature.service';
import { PrescriptionService } from './services/prescription.service';
import { PrescriptionPdfService } from './services/prescription-pdf.service';
import { PrescriptionHistoryService } from './services/prescription-history.service';

import { MedicineDirectoryController } from './controllers/medicine-directory.controller';
import { PrescriptionTemplateController } from './controllers/prescription-template.controller';
import { PrescriptionPresetController } from './controllers/prescription-preset.controller';
import { DoctorSignatureController } from './controllers/doctor-signature.controller';
import { PrescriptionController } from './controllers/prescription.controller';

import { StorageModule } from 'src/common/storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicineDirectory,
      PrescriptionTemplate,
      PrescriptionPreset,
      PrescriptionPresetMedicine,
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
    PrescriptionPresetController,
    DoctorSignatureController,
    PrescriptionController,
  ],
  providers: [
    MedicineDirectoryService,
    PrescriptionTemplateService,
    PrescriptionPresetService,
    DoctorSignatureService,
    PrescriptionService,
    PrescriptionPdfService,
    PrescriptionHistoryService,
  ],
  exports: [PrescriptionService, MedicineDirectoryService],
})
export class PrescriptionsModule {}
