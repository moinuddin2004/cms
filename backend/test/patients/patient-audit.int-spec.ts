import { AuditLog } from 'src/common/audit/entities/audit-log.entity';
import { StatusHistory } from 'src/common/audit/entities/status-history.entity';
import { AuditService } from 'src/common/audit/audit.service';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { Patient } from 'src/patients/entities/patient.entity';
import { PatientsModule } from 'src/patients/patients.module';
import { PatientsService } from 'src/patients/patients.service';
import { PATIENT_AUDIT_ENTITY } from 'src/patients/patient-audit';
import {
  accessFor,
  BillingFixture,
  createBillingFixture,
} from '../billing/billing-it.harness';

/** Every patient write leaves one audit row, in the same transaction. */
describe('Patient audit trail (Postgres)', () => {
  let fx: BillingFixture;
  let patients: PatientsService;
  let actor: ActorRef;
  let phoneSeq = Math.floor(Math.random() * 1e7);
  const phone = () => `03${String(phoneSeq++).padStart(9, '0')}`;

  const tenant = () => fx.clinicA.tenant;
  const org = () => tenant().organizationId;
  const auditRows = (subjectId: string) =>
    fx.dataSource.getRepository(AuditLog).find({
      where: { subjectId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

  beforeAll(async () => {
    fx = await createBillingFixture([PatientsModule]);
    patients = fx.app.get(PatientsService);
    actor = {
      userId: fx.clinicA.people.admin.userId,
      side: ActorSide.CLINIC,
      ip: '10.1.2.3',
      requestId: 'req-audit-1',
    };
    // Building the whole schema on a remote Postgres can take minutes.
  }, 900_000);

  afterAll(() => fx?.close());

  const newPatient = (over: Record<string, unknown> = {}) =>
    patients.create(
      tenant(),
      { fullName: 'Audit Patient', phone: phone(), ...over } as never,
      actor,
    );

  it('records the create with who, where from, and the patient as subject', async () => {
    const p = await newPatient({ dob: '1990-05-01', allergies: 'Penicillin' });
    const [row] = await auditRows(p.id);
    expect(row).toMatchObject({
      organizationId: org(),
      entityType: PATIENT_AUDIT_ENTITY.PATIENT,
      entityId: p.id,
      subjectId: p.id,
      action: 'create',
      actorUserId: actor.userId,
      actorSide: 'clinic',
      ip: '10.1.2.3',
      requestId: 'req-audit-1',
    });
    expect(row.changes?.before).toBeNull();
    expect(row.changes?.after).toMatchObject({
      fullName: 'Audit Patient',
      dob: '1990-05-01',
      allergies: 'Penicillin',
    });
    // Bookkeeping and file links are not recorded.
    for (const key of [
      'id',
      'organizationId',
      'createdAt',
      'profilePictureUrl',
    ])
      expect(row.changes?.after).not.toHaveProperty(key);
  });

  it('records only the fields an update changed, and nothing for a no-op', async () => {
    const p = await newPatient({ dob: '1990-05-01', city: 'Karachi' });
    // Same dob (string vs stored date) and city: not a change.
    await patients.update(
      p.id,
      org(),
      { dob: '1990-05-01', city: 'Karachi' } as never,
      actor,
    );
    expect(await auditRows(p.id)).toHaveLength(1);

    await patients.update(
      p.id,
      org(),
      { dob: '1990-05-01', city: 'Lahore' } as never,
      actor,
    );
    const rows = await auditRows(p.id);
    expect(rows).toHaveLength(2);
    expect(rows[1].action).toBe('update');
    expect(rows[1].changes).toEqual({
      before: { city: 'Karachi' },
      after: { city: 'Lahore' },
    });
  });

  it('logs activate/deactivate in status_history, skipping a repeat', async () => {
    const p = await newPatient();
    await patients.setActive(p.id, org(), false, actor);
    await patients.setActive(p.id, org(), false, actor);
    const rows = await fx.dataSource
      .getRepository(StatusHistory)
      .find({ where: { subjectId: p.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entityType: PATIENT_AUDIT_ENTITY.PATIENT,
      fromState: 'active',
      toState: 'inactive',
      actionCode: 'deactivate',
      actorUserId: actor.userId,
    });
  });

  it('does not save the change when the audit row fails', async () => {
    const p = await newPatient({ city: 'Karachi' });
    const spy = jest
      .spyOn(fx.app.get(AuditService), 'record')
      .mockRejectedValueOnce(new Error('audit down'));
    await expect(
      patients.update(p.id, org(), { city: 'Quetta' } as never, actor),
    ).rejects.toThrow('audit down');
    spy.mockRestore();
    const stored = await fx.dataSource
      .getRepository(Patient)
      .findOneByOrFail({ id: p.id });
    expect(stored.city).toBe('Karachi');
  });

  it('compares money columns by value, not by string form', async () => {
    const p = await newPatient();
    const plan = await patients.createTreatmentPlan(
      p.id,
      tenant(),
      {
        dentistId: fx.clinicA.people.doctor.employeeId,
        planName: 'Implant',
        estimatedCost: 50000,
      } as never,
      actor,
    );
    await patients.updateTreatmentPlan(
      p.id,
      plan.id,
      org(),
      {
        estimatedCost: 50000,
        notes: 'Patient wants it in two visits',
      } as never,
      actor,
    );
    const rows = (await auditRows(p.id)).filter(
      (r) => r.entityType === PATIENT_AUDIT_ENTITY.TREATMENT_PLAN,
    );
    expect(rows.map((r) => r.action)).toEqual(['create', 'update']);
    expect(rows[1].changes).toEqual({
      before: { notes: null },
      after: { notes: 'Patient wants it in two visits' },
    });
  });

  it('merges the patient and their records into one trail, redacted per reader', async () => {
    const p = await newPatient();
    await patients.createVitals(
      p.id,
      tenant(),
      {
        recordedBy: fx.clinicA.people.doctor.employeeId,
        bpSystolic: 140,
        bpDiastolic: 90,
      } as never,
      actor,
    );
    await patients.update(p.id, org(), { city: 'Multan' } as never, actor);

    const people = fx.clinicA.people.admin;
    const full = await patients.getAuditTrail(
      p.id,
      org(),
      accessFor(tenant(), people, { 'patients.clinical.view': true }),
    );
    expect(full.map((e) => `${e.entityType}:${e.action}`)).toEqual([
      'patient:update',
      'patient_vitals:create',
      'patient:create',
    ]);
    expect(full[1].changes?.after).toMatchObject({ bpSystolic: 140 });
    expect(full[0].actor?.id).toBe(actor.userId);

    const limited = await patients.getAuditTrail(
      p.id,
      org(),
      accessFor(tenant(), people, { 'admin.audit.view': true }),
    );
    expect(limited).toHaveLength(3);
    expect(limited[1].changes).toBeNull();
  });

  it('keeps the last state and linked-record counts when a patient is deleted', async () => {
    const p = await newPatient({ city: 'Hyderabad' });
    await patients.createVitals(
      p.id,
      tenant(),
      {
        recordedBy: fx.clinicA.people.doctor.employeeId,
        pulseRate: 72,
      } as never,
      actor,
    );
    await patients.remove(p.id, org(), actor);

    expect(
      await fx.dataSource.getRepository(Patient).findOneBy({ id: p.id }),
    ).toBeNull();
    const rows = await auditRows(p.id);
    const deleted = rows[rows.length - 1];
    expect(deleted.action).toBe('delete');
    expect(deleted.changes?.after).toBeNull();
    expect(deleted.changes?.before).toMatchObject({
      fullName: 'Audit Patient',
      city: 'Hyderabad',
      linkedRecords: { patient_vitals: 1 },
    });
  });
});
