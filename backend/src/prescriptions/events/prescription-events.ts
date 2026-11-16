import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

/** `prescription.issued` — a prescription was finalized (or re-finalized after an amendment). */
export interface PrescriptionIssuedEvent {
  prescriptionId: string;
  organizationId: string;
}

/**
 * In-process domain events of the prescriptions module. Publishing never
 * throws and never waits for subscribers, so listeners (patient medication
 * schedules, M3-01) stay out of `finalize()`'s critical path.
 */
@Injectable()
export class PrescriptionEvents {
  private readonly logger = new Logger(PrescriptionEvents.name);
  private readonly issuedSubject = new Subject<PrescriptionIssuedEvent>();

  readonly issued$: Observable<PrescriptionIssuedEvent> =
    this.issuedSubject.asObservable();

  issued(event: PrescriptionIssuedEvent): void {
    try {
      this.issuedSubject.next(event);
    } catch (err) {
      this.logger.error(
        `prescription.issued subscriber failed: ${(err as Error).message}`,
      );
    }
  }
}
