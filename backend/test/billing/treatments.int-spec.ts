import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { PatientEncounter } from 'src/encounters/entities/patient-encounter.entity';
import { ServiceKind } from 'src/billing/enums/billing.enums';
import {
  BillingFixture,
  Clinic,
  TEST_USER_HEADER,
  Who,
  createBillingFixture,
} from './billing-it.harness';
import { n } from './helpers';

/** The doctor's treatment form: pick a catalog service, never see or send a price. */
describe('Billing integration — doctor treatments from the service catalog', () => {
  let fx: BillingFixture;
  let fillingId: string;
  let consultationId: string;

  beforeAll(async () => {
    fx = await createBillingFixture();
    const fks: Array<{ conname: string }> = await fx.dataSource.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'patient_encounters'::regclass AND contype = 'f'
          AND confrelid = 'queue_entries'::regclass`,
    );
    for (const { conname } of fks)
      await fx.dataSource.query(
        `ALTER TABLE patient_encounters DROP CONSTRAINT "${conname}"`,
      );
    const admin = fx.ctx(fx.clinicA, 'admin');
    const suffix = randomUUID().slice(0, 6);
    fillingId = (
      await fx.catalog.create(admin, {
        name: `Filling ${suffix}`,
        kind: ServiceKind.PROCEDURE,
        defaultPrice: 1800,
      })
    ).id;
    consultationId = (
      await fx.catalog.create(admin, {
        name: `Consult ${suffix}`,
        kind: ServiceKind.CONSULTATION,
        defaultPrice: 1200,
      })
    ).id;
    const inactive = await fx.catalog.create(admin, {
      name: `Retired ${suffix}`,
      kind: ServiceKind.PROCEDURE,
      defaultPrice: 100,
    });
    await fx.catalog.update(admin, inactive.id, { isActive: false });
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  const call = (
    method: 'get' | 'post',
    url: string,
    who: Who,
    body?: object,
    clinic: Clinic = fx.clinicA,
  ) =>
    request(fx.app.getHttpServer())
      [method](url)
      .set(TEST_USER_HEADER, clinic.people[who].userId)
      .set('x-organization-id', clinic.tenant.organizationId)
      .set('x-location-id', clinic.tenant.locationId)
      .send(body);

  async function encounter() {
    const A = fx.clinicA;
    const patientId = await fx.newPatient(A);
    const saved = await fx.dataSource.getRepository(PatientEncounter).save({
      queueEntryId: randomUUID(),
      patientId,
      organizationId: A.tenant.organizationId,
      locationId: A.tenant.locationId,
      encounterDate: new Date(),
    } as Partial<PatientEncounter>);
    return {
      patientId,
      encounterId: saved.id,
      queueEntryId: saved.queueEntryId,
    };
  }

  it('lists active procedures to a doctor by name only', async () => {
    const res = await call('get', '/treatments/catalog', 'doctor');
    expect(res.status).toBe(200);
    const rows = res.body.data as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.id)).toContain(fillingId);
    expect(rows.map((r) => r.id)).not.toContain(consultationId);
    expect(rows.every((r) => !('defaultPrice' in r) && !('price' in r))).toBe(
      true,
    );
    expect(rows.every((r) => !String(r.name).startsWith('Retired'))).toBe(true);
  });

  it('records a treatment from a service: no price in the response, billing prices it from the catalog', async () => {
    const e = await encounter();
    const res = await call('post', '/treatments', 'doctor', {
      patientId: e.patientId,
      encounterId: e.encounterId,
      serviceId: fillingId,
      notes: 'Tooth: 16',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.serviceId).toBe(fillingId);
    expect(res.body.data.treatmentName).toMatch(/^Filling /);
    expect(res.body.data).not.toHaveProperty('cost');

    // Completing the visit creates the TREATMENT charge from the service.
    await fx.dataSource.transaction((manager) =>
      fx.sources.syncForEncounter(manager, {
        tenant: fx.clinicA.tenant,
        queueEntryId: e.queueEntryId,
        doctorId: fx.clinicA.people.doctor.employeeId,
        completedAt: new Date(),
        actorUserId: fx.clinicA.people.doctor.userId,
      }),
    );
    const [charge] = await fx.dataSource.query(
      `SELECT unit_price, service_id, needs_pricing FROM charges
        WHERE patient_id = $1 AND source = 'TREATMENT'`,
      [e.patientId],
    );
    expect(n(charge.unit_price)).toBe(1800);
    expect(charge.service_id).toBe(fillingId);
    expect(charge.needs_pricing).toBe(false);
  });

  it('ignores a price sent together with a service and rejects an unusable service', async () => {
    const e = await encounter();
    const ok = await call('post', '/treatments', 'reception', {
      patientId: e.patientId,
      encounterId: e.encounterId,
      serviceId: fillingId,
      cost: 1,
    });
    expect(ok.status).toBe(201);
    const [row] = await fx.dataSource.query(
      `SELECT cost FROM treatments WHERE id = $1`,
      [ok.body.data.id],
    );
    expect(row.cost).toBeNull();

    const wrongKind = await call('post', '/treatments', 'doctor', {
      patientId: e.patientId,
      serviceId: consultationId,
    });
    expect(wrongKind.status).toBe(422);
    expect(wrongKind.body.code ?? wrongKind.body.error?.code).toBe(
      'TREATMENT_SERVICE_INVALID',
    );

    const otherOrg = await call('post', '/treatments', 'doctor', {
      patientId: e.patientId,
      serviceId: randomUUID(),
    });
    expect(otherOrg.status).toBe(404);

    const nothing = await call('post', '/treatments', 'doctor', {
      patientId: e.patientId,
    });
    expect(nothing.status).toBe(400);
  });

  it('hides the legacy fee from doctors in every treatment listing but not from reception', async () => {
    const e = await encounter();
    const legacy = await call('post', '/treatments', 'reception', {
      patientId: e.patientId,
      encounterId: e.encounterId,
      treatmentName: 'Old style entry',
      cost: 500,
    });
    expect(legacy.status).toBe(201);
    expect(legacy.body.data.cost).toBeDefined(); // reception keeps seeing it

    const asDoctor = await call(
      'get',
      `/treatments?encounterId=${e.encounterId}`,
      'doctor',
    );
    expect(asDoctor.status).toBe(200);
    expect(JSON.stringify(asDoctor.body)).not.toContain('"cost"');
    const asReception = await call(
      'get',
      `/treatments?encounterId=${e.encounterId}`,
      'reception',
    );
    expect(asReception.body.data[0].cost).toBeDefined();
  });
});
