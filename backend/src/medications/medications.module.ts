import { Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { catchError, concatMap, EMPTY, from, Subscription } from 'rxjs';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { PrescriptionEvents } from 'src/prescriptions/events/prescription-events';
import { PrescriptionsModule } from 'src/prescriptions/prescriptions.module';
import { MedicationDoseEvent } from './entities/medication-dose-event.entity';
import { MedicationSchedule } from './entities/medication-schedule.entity';
import { MedicationSyncService } from './medication-sync.service';

/**
 * Patient medication schedules (M3-01). Subscribes to `prescription.issued`;
 * handlers run one at a time, off the finalize request, and never throw.
 */
@Module({
  imports: [
    FeatureFlagsModule,
    PrescriptionsModule,
    TypeOrmModule.forFeature([MedicationSchedule, MedicationDoseEvent]),
  ],
  providers: [MedicationSyncService],
  exports: [TypeOrmModule, MedicationSyncService],
})
export class MedicationsModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MedicationsModule.name);
  private subscription?: Subscription;

  constructor(
    private readonly events: PrescriptionEvents,
    private readonly sync: MedicationSyncService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.events.issued$
      .pipe(
        concatMap((event) =>
          from(this.sync.syncPrescription(event.prescriptionId)).pipe(
            catchError((err: Error) => {
              this.logger.error(
                `medication sync failed for prescription ${event.prescriptionId}: ${err.message}`,
              );
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe();
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
