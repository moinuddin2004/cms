import { PatientRealtimeGateway } from 'src/patient-app/realtime/patient-realtime.gateway';
import { InProcessRealtimePublisher } from './in-process-realtime.publisher';
import { QueueGateway } from './queue.gateway';

describe('InProcessRealtimePublisher', () => {
  it('a failing patient gateway never skips staff emits or fails the relay batch', async () => {
    const staff = { publish: jest.fn() };
    const patient = {
      publish: jest.fn().mockImplementation(() => {
        throw new Error('bad message');
      }),
    };
    const publisher = new InProcessRealtimePublisher(
      staff as unknown as QueueGateway,
      patient as unknown as PatientRealtimeGateway,
    );

    await expect(
      publisher.publish([
        { topic: 'session:a', payload: { seq: 1 } },
        { topic: 'session:b', payload: { seq: 2 } },
      ]),
    ).resolves.toBeUndefined();

    expect(staff.publish).toHaveBeenCalledTimes(2);
    expect(patient.publish).toHaveBeenCalledTimes(2);
  });
});
