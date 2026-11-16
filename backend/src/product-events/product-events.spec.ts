import { RATE_LIMIT_KEY } from 'src/auth/guards/rate-limiter.guard';
import { PatientEventsController } from 'src/patient-app/events.controller';
import { IS_PATIENT_API } from 'src/patient-app/decorators/patient-api.decorator';
import { PRODUCT_EVENTS, ProductEventSpec } from './product-event-catalog';
import { ProductEventsService, sanitizeProps } from './product-events.service';
import { StaffEventsController } from './staff-events.controller';

const NOW = new Date('2026-11-15T10:00:00Z');

function service() {
  const insert = jest.fn().mockResolvedValue(undefined);
  return { svc: new ProductEventsService({ insert } as never), insert };
}

describe('sanitizeProps', () => {
  const spec = PRODUCT_EVENTS.patient_signed_in as ProductEventSpec;

  it('keeps allow-listed enum values and drops everything else', () => {
    expect(
      sanitizeProps(spec, {
        method: 'google',
        isNewAccount: true,
        email: 'a@b.com',
        fullName: 'Jane',
      }),
    ).toEqual({ method: 'google', isNewAccount: 'true' });
  });

  it('drops a value outside the enum, objects and numbers', () => {
    expect(
      sanitizeProps(spec, { method: 'sms', isNewAccount: { a: 1 } }),
    ).toEqual({});
    expect(sanitizeProps(spec, undefined)).toEqual({});
  });

  it('accepts only a version-shaped appVersion', () => {
    const open = PRODUCT_EVENTS.app_opened as ProductEventSpec;
    expect(sanitizeProps(open, { appVersion: '1.2.3' })).toEqual({
      appVersion: '1.2.3',
    });
    expect(sanitizeProps(open, { appVersion: 'Dr Ali 0300-1234567' })).toEqual(
      {},
    );
  });

  it('no catalog prop is free text (every prop is an enum or version)', () => {
    for (const spec of Object.values(PRODUCT_EVENTS) as ProductEventSpec[])
      for (const allowed of Object.values(spec.props))
        expect(allowed === 'version' || Array.isArray(allowed)).toBe(true);
  });
});

describe('ProductEventsService.record', () => {
  it('stores valid events, drops unknown names and other-space names', async () => {
    const { svc, insert } = service();
    const res = await svc.record(
      'staff',
      'user-1',
      null,
      [
        { name: 'staff_called_next' },
        { name: 'drop_table' },
        { name: 'records_opened', props: { kind: 'visits' } }, // patient-only
        {
          name: 'staff_checked_in',
          props: { source: 'walk_in', patientId: 'x' },
        },
      ],
      NOW,
    );
    expect(res).toEqual({ accepted: 2 });
    const rows = insert.mock.calls[0][0];
    expect(rows.map((r: { name: string }) => r.name)).toEqual([
      'staff_called_next',
      'staff_checked_in',
    ]);
    expect(rows[1].props).toEqual({ source: 'walk_in' });
    expect(rows[0]).toMatchObject({ actorType: 'staff', actorId: 'user-1' });
  });

  it('does not touch the database when nothing is valid', async () => {
    const { svc, insert } = service();
    expect(
      await svc.record('patient', 'a', null, [{ name: 'x' }], NOW),
    ).toEqual({
      accepted: 0,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('keeps a sane client time, replaces a future or ancient one with now', async () => {
    const { svc, insert } = service();
    await svc.record(
      'patient',
      'a',
      null,
      [
        { name: 'patient_app_opened', at: '2026-11-15T09:00:00Z' },
        { name: 'patient_app_opened', at: '2030-01-01T00:00:00Z' },
        { name: 'patient_app_opened', at: '2020-01-01T00:00:00Z' },
      ],
      NOW,
    );
    const at = insert.mock.calls[0][0].map((r: { at: Date }) =>
      r.at.toISOString(),
    );
    expect(at).toEqual([
      '2026-11-15T09:00:00.000Z',
      NOW.toISOString(),
      NOW.toISOString(),
    ]);
  });
});

describe('endpoints', () => {
  it('both are rate limited; the patient one is fenced', () => {
    expect(
      Reflect.getMetadata(
        RATE_LIMIT_KEY,
        StaffEventsController.prototype.track,
      ),
    ).toBeDefined();
    expect(
      Reflect.getMetadata(
        RATE_LIMIT_KEY,
        PatientEventsController.prototype.track,
      ),
    ).toBeDefined();
    expect(Reflect.getMetadata(IS_PATIENT_API, PatientEventsController)).toBe(
      true,
    );
  });
});
