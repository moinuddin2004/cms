import { randomUUID } from 'crypto';
import { PatientEncounter } from 'src/encounters/entities/patient-encounter.entity';
import { Treatment } from 'src/treatments/entities/treatment.entity';
import { ServiceKind } from 'src/billing/enums/billing.enums';
import { BillingFixture, createBillingFixture } from './billing-it.harness';
import { n } from './helpers';

/** Plan 12.2 S16 — charges created by completing a consultation (D4, 6.4). */
describe('Billing integration — charges from a completed consultation', () => {
  let fx: BillingFixture;
  let consultationId: string;
  let fillingId: string;
  let scalingId: string;

  beforeAll(async () => {
    fx = await createBillingFixture();
    // Queue entries are not what is under test: drop the encounter → queue entry
    // FK in this throw-away schema so encounters can be seeded without a queue.
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
    const make = (name: string, kind: ServiceKind, defaultPrice: number) =>
      fx.catalog.create(admin, {
        name: `${name} ${randomUUID().slice(0, 6)}`,
        kind,
        defaultPrice,
      });
    consultationId = (
      await make('Consultation', ServiceKind.CONSULTATION, 1200)
    ).id;
    fillingId = (await make('Filling', ServiceKind.PROCEDURE, 1800)).id;
    scalingId = (await make('Scaling', ServiceKind.PROCEDURE, 3000)).id;
    await fx.settings.update(admin, {
      defaultConsultationServiceId: consultationId,
    });
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  async function visit() {
    const A = fx.clinicA;
    const patientId = await fx.newPatient(A);
    const queueEntryId = randomUUID();
    const encounter = await fx.dataSource.getRepository(PatientEncounter).save({
      queueEntryId,
      patientId,
      organizationId: A.tenant.organizationId,
      locationId: A.tenant.locationId,
      encounterDate: new Date(),
    } as Partial<PatientEncounter>);
    const addTreatment = (
      treatmentName: string,
      serviceId: string | null,
      cost: number | null = null,
    ) =>
      fx.dataSource.getRepository(Treatment).save({
        patientId,
        encounterId: encounter.id,
        organizationId: A.tenant.organizationId,
        locationId: A.tenant.locationId,
        treatmentName,
        serviceId,
        cost,
        date: new Date(),
      } as Partial<Treatment>);
    const complete = () =>
      fx.dataSource.transaction((manager) =>
        fx.sources.syncForEncounter(manager, {
          tenant: A.tenant,
          queueEntryId,
          doctorId: A.people.doctor.employeeId,
          completedAt: new Date(),
          actorUserId: A.people.doctor.userId,
        }),
      );
    const charges = async () => {
      const rows: Array<Record<string, string | boolean | null>> =
        await fx.dataSource.query(
          `SELECT id, source, source_id, description, unit_price, net_amount, status, invoice_id,
                needs_pricing, doctor_id, source_removed_at
           FROM charges WHERE patient_id = $1 ORDER BY created_at, description`,
          [patientId],
        );
      return rows;
    };
    return { patientId, addTreatment, complete, charges };
  }

  it('prices consultation and treatments from the catalog, once, with the doctor on each', async () => {
    const v = await visit();
    await v.addTreatment('Filling UR6', fillingId);
    await v.complete();
    await v.complete(); // the doctor re-completes: nothing is duplicated

    const rows = await v.charges();
    expect(rows).toHaveLength(2);
    const bySource = new Map(rows.map((r) => [r.source as string, r]));
    expect(n(bySource.get('CONSULTATION')!.unit_price)).toBe(1200);
    expect(n(bySource.get('TREATMENT')!.unit_price)).toBe(1800);
    expect(
      rows.every((r) => r.doctor_id === fx.clinicA.people.doctor.employeeId),
    ).toBe(true);
    expect(await fx.violations(fx.clinicA, v.patientId)).toEqual([]);
  });

  it('a treatment added later is billed on the next completion; a legacy cost still prices an uncatalogued one', async () => {
    const v = await visit();
    await v.addTreatment('Scaling', scalingId);
    await v.complete();
    await v.addTreatment('Old style entry', null, 500);
    await v.addTreatment('Mystery', null, null);
    await v.complete();

    const rows = await v.charges();
    expect(rows).toHaveLength(4);
    const legacy = rows.find((r) => r.description === 'Old style entry')!;
    expect(n(legacy.unit_price)).toBe(500);
    expect(legacy.needs_pricing).toBe(false);
    const mystery = rows.find((r) => r.description === 'Mystery')!;
    expect(mystery.needs_pricing).toBe(true);
    const summary = await fx.patientBilling.summary(
      fx.clinicA.tenant,
      v.patientId,
    );
    expect(summary.needsPricingCount).toBe(1);
  });

  it('S16: a removed treatment voids its unbilled charge, but only flags a billed one', async () => {
    const v = await visit();
    const filling = await v.addTreatment('Filling', fillingId);
    const scaling = await v.addTreatment('Scaling', scalingId);
    await v.complete();

    // Reception bills the scaling charge before the doctor changes their mind.
    const rows = await v.charges();
    const scalingCharge = rows.find((r) => r.source_id === scaling.id)!;
    await fx.invoices.create(fx.ctx(fx.clinicA), {
      patientId: v.patientId,
      chargeIds: [scalingCharge.id as string],
    });

    await fx.dataSource.getRepository(Treatment).delete({ id: filling.id });
    await fx.dataSource.getRepository(Treatment).delete({ id: scaling.id });
    await v.complete();

    const after = await v.charges();
    const fillingCharge = after.find((r) => r.source_id === filling.id)!;
    expect(fillingCharge.status).toBe('VOID');
    const billed = after.find((r) => r.source_id === scaling.id)!;
    expect(billed.status).toBe('ACTIVE');
    expect(billed.source_removed_at).not.toBeNull();
    const summary = await fx.patientBilling.summary(
      fx.clinicA.tenant,
      v.patientId,
    );
    expect(summary.needsReviewCount).toBe(1);
    expect(await fx.violations(fx.clinicA, v.patientId)).toEqual([]);
  });
});
