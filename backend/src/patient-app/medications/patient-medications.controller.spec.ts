import { ValidationPipe } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { IS_PATIENT_API } from '../decorators/patient-api.decorator';
import {
  DoseEventsQueryDto,
  MedicationsQueryDto,
  PatchMedicationDto,
  RecordDoseEventsDto,
} from './patient-medications.dto';
import { PatientMedicationsController } from './patient-medications.controller';
import type { PatientMedicationsService } from './patient-medications.service';

// Same options as bootstrap/http.ts.
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});
const validate = (metatype: any, value: unknown, type: 'body' | 'query' = 'body') =>
  pipe.transform(value, { type, metatype });

const UUID = '11111111-1111-4111-8111-111111111111';
const event = (over: Record<string, unknown> = {}) => ({
  scheduleId: UUID,
  dueAt: '2026-11-15T03:00:00Z',
  action: 'taken',
  actedAt: '2026-11-15T03:05:00Z',
  ...over,
});

describe('PatientMedicationsController', () => {
  it('is a patient-api controller; routes are ordered so dose-events is not an :id', () => {
    expect(Reflect.getMetadata(IS_PATIENT_API, PatientMedicationsController)).toBe(true);
    expect(Reflect.getMetadata(PATH_METADATA, PatientMedicationsController)).toBe(
      'patient-api/medications',
    );
    const proto = PatientMedicationsController.prototype;
    const order = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');
    const path = (n: string) => Reflect.getMetadata(PATH_METADATA, (proto as any)[n]);
    const method = (n: string) => Reflect.getMetadata(METHOD_METADATA, (proto as any)[n]);
    expect(order.map((n) => `${method(n)}:${path(n)}`)).toEqual([
      '0:/',
      '0:dose-events',
      '1:dose-events',
      '4::id',
    ]);
  });

  it('wraps service results in ResponseWrapper', async () => {
    const svc = {
      list: jest.fn().mockResolvedValue([{ id: 'x' }]),
      patch: jest.fn().mockResolvedValue({ id: 'x' }),
      listDoseEvents: jest.fn().mockResolvedValue([]),
      recordDoseEvents: jest.fn().mockResolvedValue({ accepted: 1 }),
    } as unknown as PatientMedicationsService;
    const c = new PatientMedicationsController(svc);
    const ctx = { accountId: 'a' } as any;
    expect(JSON.stringify(await c.list(ctx, {}))).toContain('"id":"x"');
    expect(JSON.stringify(await c.recordDoseEvents(ctx, { events: [] } as any))).toContain('accepted');
    expect(svc.recordDoseEvents).toHaveBeenCalledWith(ctx, []);
  });

  describe('PatchMedicationDto allowlist', () => {
    it('accepts the three fields', async () => {
      await expect(
        validate(PatchMedicationDto, { times: ['08:00', '21:30'], endDate: '2026-12-01', status: 'paused' }),
      ).resolves.toBeDefined();
      await expect(validate(PatchMedicationDto, { endDate: null })).resolves.toBeDefined();
    });

    it.each([
      [{ times: ['8:00'] }],
      [{ times: ['24:00'] }],
      [{ times: ['08:60'] }],
      [{ times: 'x'.repeat(5) }],
      [{ times: Array.from({ length: 13 }, (_, i) => `0${i % 10}:00`) }],
      [{ endDate: '01/12/2026' }],
      [{ status: 'completed' }],
      [{ status: 'deleted' }],
      [{ name: 'Hacked' }],
      [{ profileId: UUID }],
      [{ prescriptionId: UUID }],
      [{ doseText: 'x' }],
    ])('rejects %j', async (body) => {
      await expect(validate(PatchMedicationDto, body)).rejects.toBeDefined();
    });
  });

  describe('dose events DTOs', () => {
    it('accepts a valid batch', async () => {
      await expect(validate(RecordDoseEventsDto, { events: [event()] })).resolves.toBeDefined();
    });

    it('caps a batch at 200 and refuses empty', async () => {
      await expect(
        validate(RecordDoseEventsDto, { events: Array.from({ length: 200 }, () => event()) }),
      ).resolves.toBeDefined();
      await expect(
        validate(RecordDoseEventsDto, { events: Array.from({ length: 201 }, () => event()) }),
      ).rejects.toBeDefined();
      await expect(validate(RecordDoseEventsDto, { events: [] })).rejects.toBeDefined();
    });

    it.each([
      [event({ scheduleId: 'nope' })],
      [event({ action: 'snoozed' })],
      [event({ dueAt: 'tomorrow' })],
      [event({ actedAt: undefined })],
      [event({ extra: 1 })],
    ])('rejects event %j', async (bad) => {
      await expect(validate(RecordDoseEventsDto, { events: [bad] })).rejects.toBeDefined();
    });

    it('rejects unknown top-level keys', async () => {
      await expect(validate(RecordDoseEventsDto, { events: [event()], profileId: UUID })).rejects.toBeDefined();
    });

    it('queries require from and to', async () => {
      await expect(
        validate(DoseEventsQueryDto, { from: '2026-11-15T00:00:00Z', to: '2026-11-16T00:00:00Z' }, 'query'),
      ).resolves.toBeDefined();
      await expect(validate(DoseEventsQueryDto, { from: '2026-11-15T00:00:00Z' }, 'query')).rejects.toBeDefined();
    });
  });

  it('list query takes only profileId and updatedSince', async () => {
    await expect(
      validate(MedicationsQueryDto, { updatedSince: '2026-11-15T00:00:00Z', profileId: UUID }, 'query'),
    ).resolves.toBeDefined();
    await expect(validate(MedicationsQueryDto, { limit: '5' }, 'query')).rejects.toBeDefined();
    await expect(validate(MedicationsQueryDto, { profileId: 'x' }, 'query')).rejects.toBeDefined();
  });
});
