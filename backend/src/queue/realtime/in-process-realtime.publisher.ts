import { Injectable } from '@nestjs/common';
import { QueueGateway } from './queue.gateway';
import { OutboxMessagePayload, RealtimePublisher } from './realtime-bus';

/** `all` mode (single process, e.g. `start:dev`): relay emits straight to the local gateway. */
@Injectable()
export class InProcessRealtimePublisher implements RealtimePublisher {
  constructor(private readonly gateway: QueueGateway) {}

  publish(messages: OutboxMessagePayload[]): Promise<void> {
    for (const m of messages) this.gateway.publish(m.topic, m.payload);
    return Promise.resolve();
  }
}
