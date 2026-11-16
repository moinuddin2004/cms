import { ConfigService } from '@nestjs/config';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AuditService } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { MedicationSyncService } from 'src/medications/medication-sync.service';
import { PatientLinksModule } from 'src/patient-links/patient-links.module';
import { ClaimsService } from 'src/patient-links/claims.service';
import { PrescriptionEvents } from 'src/prescriptions/events/prescription-events';
import { PrescriptionsModule } from 'src/prescriptions/prescriptions.module';
import { PrescriptionPdfService } from 'src/prescriptions/services/prescription-pdf.service';
import { SettingsRegistryService } from 'src/settings-registry/settings-registry.service';
import { PatientMedicationsController } from './medications/patient-medications.controller';
import { PatientMedicationsService } from './medications/patient-medications.service';
import { PatientAppModule } from './patient-app.module';

/**
 * DI smoke test: PatientAppModule and the MedicationsModule it imports must
 * compile (Nest throws on any unresolved dependency — e.g. a controller whose
 * service was never registered) and must start the `prescription.issued`
 * subscriber. Only infrastructure outside the modules under test is stubbed.
 */
const dataSource = {
  entityMetadatas: [],
  options: { type: 'postgres' },
  getRepository: () => ({}),
  query: jest.fn().mockResolvedValue([]),
};

@Global()
@Module({
  providers: [
    { provide: ConfigService, useValue: {} },
    { provide: ClockService, useValue: {} },
    { provide: AuditService, useValue: {} }, // global AuditModule in the app
    { provide: SettingsRegistryService, useValue: {} },
    { provide: getDataSourceToken(), useValue: dataSource },
  ],
  exports: [
    ConfigService,
    ClockService,
    AuditService,
    SettingsRegistryService,
    getDataSourceToken(),
  ],
})
class InfraStub {}

@Module({
  providers: [PrescriptionEvents, { provide: PrescriptionPdfService, useValue: {} }],
  exports: [PrescriptionEvents, PrescriptionPdfService],
})
class PrescriptionsStub {}

@Module({
  providers: [{ provide: FeatureFlagsService, useValue: {} }],
  exports: [FeatureFlagsService],
})
class FeatureFlagsStub {}

@Module({
  providers: [{ provide: ClaimsService, useValue: {} }],
  exports: [ClaimsService],
})
class PatientLinksStub {}

describe('PatientAppModule wiring (medications)', () => {
  it('compiles with the controller, service and subscriber registered', async () => {
    const syncPrescription = jest.fn().mockResolvedValue({});
    const moduleRef = await Test.createTestingModule({
      imports: [InfraStub, PatientAppModule],
    })
      .overrideModule(PrescriptionsModule)
      .useModule(PrescriptionsStub)
      .overrideModule(FeatureFlagsModule)
      .useModule(FeatureFlagsStub)
      .overrideModule(PatientLinksModule)
      .useModule(PatientLinksStub)
      .overrideProvider(MedicationSyncService)
      .useValue({ syncPrescription })
      .compile();

    expect(moduleRef.get(PatientMedicationsController)).toBeInstanceOf(
      PatientMedicationsController,
    );
    expect(
      moduleRef.get(PatientMedicationsService, { strict: false }),
    ).toBeInstanceOf(PatientMedicationsService);

    await moduleRef.init();
    moduleRef
      .get(PrescriptionEvents, { strict: false })
      .issued({ prescriptionId: 'rx-1', organizationId: 'org-1' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(syncPrescription).toHaveBeenCalledWith('rx-1');
    await moduleRef.close();
  });
});
