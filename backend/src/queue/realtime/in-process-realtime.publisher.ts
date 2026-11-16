import { Injectable, Logger } from '@nestjs/common';
import { PatientRealtimeGateway } from 'src/patient-app/realtime/patient-realtime.gateway';
import { QueueGateway } from './queue.gateway';
import { OutboxMessagePayload, RealtimePublisher } from './realtime-bus';

/** `all` mode (single process, e.g. `start:dev`): relay emits straight to the local gateway. */
@Injectable()
export class InProcessRealtimePublisher implements RealtimePublisher {
  private readonly logger = new Logger(InProcessRealtimePublisher.name);

  constructor(
    private readonly gateway: QueueGateway,
    private readonly patientGateway: PatientRealtimeGateway,
  ) {}

  publish(messages: OutboxMessagePayload[]): Promise<void> {
    for (const m of messages) {
      this.gateway.publish(m.topic, m.payload);
      // A patient-side failure must not skip staff emits or make the relay retry.
      try {
        this.patientGateway.publish(m.topic, m.payload);
      } catch (err) {
        this.logger.warn(
          `Patient realtime publish failed: ${(err as Error).message}`,
        );
      }
    }
    return Promise.resolve();
  }
}
