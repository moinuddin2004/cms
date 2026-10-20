import { randomUUID } from 'crypto';
import { PatientEncounter } from 'src/encounters/entities/patient-encounter.entity';
import { Treatment } from 'src/treatments/entities/treatment.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { Location } from 'src/locations/entities/location.entity';
import { PayrollRecord } from 'src/payroll/entities/payroll-record.entity';
import { PayrollService } from 'src/payroll/payroll.service';
import { PaymentMethod, PayrollStatus } from 'src/payroll/enums/payroll.enums';
import { Charge } from 'src/billing/entities/charge.entity';
import { DiscountKind, ServiceKind } from 'src/billing/enums/billing.enums';
import { CommissionEntry } from 'src/billing/commissions/entities/commission-entry.entity';
import { CommissionSettlement } from 'src/billing/commissions/entities/commission-settlement.entity';
import { CompensationPlansService } from 'src/billing/commissions/compensation-plans.service';
import { CommissionService } from 'src/billing/commissions/commission.service';
import { CommissionReportsService } from 'src/billing/commissions/commission-reports.service';
import {
  COMMISSIONS_FEATURE,
  CommissionBasis,
  CommissionSettlementStatus,
  CommissionSourceType,
  CompensationPlanType,
} from 'src/billing/commissions/commission.enums';
import { CommissionSettlements } from 'src/billing/commissions/commission-settlements';
import { AllocationMode } from 'src/billing/enums/billing.enums';
import { Actor, AppRole } from 'src/common/enums/app-role.enum';
import { BillingFixture, createBillingFixture } from './billing-it.harness';

/**
 * Doctor commissions (docs/commissions.md), in the style of the billing
 * scenarios: real services on the isolated schema, invariants checked after
 * each scenario (I10 = commission ledger equals its target).
 */
describe('Billing integration — doctor commissions', () => {
  let fx: BillingFixture;
  let plans: CompensationPlansService;
  let commissions: CommissionService;
  let reports: CommissionReportsService;
  let consultationId: string;
  let scalingId: string;
  /** Main commission doctor of clinic A (40% NET at the start). */
  let drAssignment: string;
  let drEmployee: string;
  let admin: Actor;

  beforeAll(async () => {
    fx = await createBillingFixture();
    plans = fx.app.get(CompensationPlansService);
    commissions = fx.app.get(CommissionService);
    reports = fx.app.get(CommissionReportsService);
    const fks: Array<{ conname: string }> = await fx.dataSource.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'patient_encounters'::regclass AND contype = 'f'
          AND confrelid = 'queue_entries'::regclass`,
    );
    for (const { conname } of fks)
      await fx.dataSource.query(
        `ALTER TABLE patient_encounters DROP CONSTRAINT "${conname}"`,
      );

    const A = fx.clinicA;
    await fx.flags.toggleFeature(
      A.tenant.organizationId,
      COMMISSIONS_FEATURE,
      true,
    );
    const ctx = fx.ctx(A, 'admin');
    consultationId = (
      await fx.catalog.create(ctx, {
        name: `Consultation ${randomUUID().slice(0, 6)}`,
        kind: ServiceKind.CONSULTATION,
        defaultPrice: 0,
      })
    ).id;
    scalingId = (
      await fx.catalog.create(ctx, {
        name: `Scaling ${randomUUID().slice(0, 6)}`,
        kind: ServiceKind.PROCEDURE,
        defaultPrice: 1000,
      })
    ).id;
    // Consultation is free here so each visit has one paid charge (Scaling).
    await fx.settings.update(ctx, {
      defaultConsultationServiceId: consultationId,
    });

    drEmployee = A.people.doctor.employeeId;
    drAssignment = await assignmentOf(drEmployee);
    admin = {
      userId: A.people.admin.userId,
      roles: [AppRole.CLINIC_ADMIN],
      employeeId: null,
    };
    await plans.create(A.tenant, admin, drAssignment, {
      type: CompensationPlanType.COMMISSION,
      defaultRateBps: 4000,
      commissionBasis: CommissionBasis.NET,
      effectiveFrom: '2024-01-01',
    });
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  async function assignmentOf(employeeId: string): Promise<string> {
    const a = await fx.dataSource
      .getRepository(EmployeeOrgLocationAssignment)
      .findOneByOrFail({
        employeeId,
        locationId: fx.clinicA.tenant.locationId,
      });
    return a.id;
  }

  /** Another consulting doctor at clinic A (own assignment, own plan). */
  async function newDoctor(
    name: string,
  ): Promise<{ employeeId: string; assignmentId: string }> {
    const A = fx.clinicA;
    const em = fx.dataSource.manager;
    const role = await em.getRepository(EmploymentRole).findOneByOrFail({
      organizationId: A.tenant.organizationId,
      slug: 'doctor',
    });
    const employee = await em.getRepository(Employee).save({
      fullName: name,
      phone: `03${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
    } as Partial<Employee>);
    const a = await em.getRepository(EmployeeOrgLocationAssignment).save({
      employeeId: employee.id,
      organizationId: A.tenant.organizationId,
      locationId: A.tenant.locationId,
      employmentRoleId: role.id,
      designation: 'Dentist',
      employeeCode: `D${Math.floor(Math.random() * 1e6)}`,
      joiningDate: new Date('2024-01-01'),
      createdBy: A.people.admin.userId,
    } as Partial<EmployeeOrgLocationAssignment>);
    return { employeeId: employee.id, assignmentId: a.id };
  }

  /** A completed visit by `doctorId` with one Scaling (Rs 1,000 unless repriced). */
  async function visit(
    doctorId: string | null = drEmployee,
  ): Promise<{ patientId: string; chargeId: string }> {
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
    await fx.dataSource.getRepository(Treatment).save({
      patientId,
      encounterId: encounter.id,
      organizationId: A.tenant.organizationId,
      locationId: A.tenant.locationId,
      treatmentName: 'Scaling',
      serviceId: scalingId,
      date: new Date(),
    } as Partial<Treatment>);
    await fx.dataSource.transaction((manager) =>
      fx.sources.syncForEncounter(manager, {
        tenant: A.tenant,
        queueEntryId,
        doctorId: doctorId as string,
        completedAt: new Date(),
        actorUserId: A.people.doctor.userId,
      }),
    );
    const charge = await fx.dataSource.getRepository(Charge).findOneByOrFail({
      encounterId: encounter.id,
      serviceId: scalingId,
    });
    return { patientId, chargeId: charge.id };
  }

  const entriesOf = (chargeId: string) =>
    fx.dataSource.getRepository(CommissionEntry).find({
      where: { chargeId },
      order: { createdAt: 'ASC' },
    });
  const amounts = async (chargeId: string) =>
    (await entriesOf(chargeId)).map((e) => e.amountPaisa);
  const pay = (
    patientId: string,
    chargeId: string,
    amount: number,
    clientRequestId = randomUUID(),
  ) =>
    fx.collect(fx.clinicA, patientId, {
      amount,
      mode: AllocationMode.MANUAL,
      applyAdvance: false,
      selections: [{ chargeId, amount }],
      clientRequestId,
    });

  afterEach(async () => {
    // Every scenario leaves the books consistent, incl. I10 for every patient.
    const rows: Array<{ patient_id: string }> = await fx.dataSource.query(
      `SELECT DISTINCT patient_id FROM charges WHERE location_id = $1`,
      [fx.clinicA.tenant.locationId],
    );
    for (const r of rows) {
      expect(await fx.violations(fx.clinicA, r.patient_id)).toEqual([]);
    }
  });

  it('snapshots the doctor, plan and rate on visit charges', async () => {
    const { chargeId } = await visit();
    const c = await fx.dataSource
      .getRepository(Charge)
      .findOneByOrFail({ id: chargeId });
    expect(c.performingAssignmentId).toBe(drAssignment);
    expect(c.commissionPlanId).not.toBeNull();
    expect(c.commissionRateBps).toBe(4000);
    expect(c.commissionFixedPaisa).toBeNull();
  });

  it('full payment → one entry', async () => {
    const { patientId, chargeId } = await visit();
    await pay(patientId, chargeId, 1000);
    const entries = await entriesOf(chargeId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      sourceType: CommissionSourceType.ALLOCATION,
      amountPaisa: 40_000,
      basePaisa: 100_000,
      rateBps: 4000,
      settlementId: null,
    });
  });

  it('partial then full payment → two entries summing exactly to the target', async () => {
    const { patientId, chargeId } = await visit();
    await pay(patientId, chargeId, 333.33);
    await pay(patientId, chargeId, 666.67);
    expect(await amounts(chargeId)).toEqual([13_333, 26_667]);
  });

  it('same request replayed (idempotency) → no duplicate entries', async () => {
    const { patientId, chargeId } = await visit();
    const requestId = randomUUID();
    await pay(patientId, chargeId, 1000, requestId);
    await pay(patientId, chargeId, 1000, requestId);
    expect(await amounts(chargeId)).toEqual([40_000]);
    // Re-running the recorder finds nothing to add.
    await fx.dataSource.transaction((m) =>
      commissions.recordForCharges(m, [chargeId], {
        type: CommissionSourceType.ALLOCATION,
      }),
    );
    expect(await amounts(chargeId)).toEqual([40_000]);
  });

  it('unapply → negative entry', async () => {
    const { patientId, chargeId } = await visit();
    const res = await pay(patientId, chargeId, 1000);
    await fx.payments.unapply(fx.ctx(fx.clinicA, 'admin'), res.payment!.id, {
      reason: 'Paid by mistake',
    });
    const entries = await entriesOf(chargeId);
    expect(entries.map((e) => [e.sourceType, e.amountPaisa])).toEqual([
      [CommissionSourceType.ALLOCATION, 40_000],
      [CommissionSourceType.UNAPPLY, -40_000],
    ]);
  });

  it('discount after payment → adjustment entry', async () => {
    const { patientId, chargeId } = await visit();
    const res = await pay(patientId, chargeId, 1000);
    const inv = await fx.invoices.detail(fx.clinicA.tenant, res.invoiceId!);
    await fx.invoices.edit(
      fx.ctx(fx.clinicA, 'admin'),
      inv.id,
      {
        expectedRevision: inv.revision,
        operations: [
          {
            op: 'setDiscount',
            chargeId,
            kind: DiscountKind.FIXED,
            value: 200,
            note: 'Goodwill',
          },
        ],
      } as never,
      'Goodwill discount after payment',
    );
    // Net 800 now, 200 went back to advance: 40% of 800 = 320.
    expect(await amounts(chargeId)).toEqual([40_000, -8_000]);
    const entries = await entriesOf(chargeId);
    expect(entries[1].sourceType).toBe(CommissionSourceType.CHARGE_ADJUST);
  });

  it('voiding a paid charge → VOID entry reverses it', async () => {
    const { patientId, chargeId } = await visit();
    const res = await pay(patientId, chargeId, 1000);
    const inv = await fx.invoices.detail(fx.clinicA.tenant, res.invoiceId!);
    await fx.invoices.edit(
      fx.ctx(fx.clinicA, 'admin'),
      inv.id,
      {
        expectedRevision: inv.revision,
        operations: [{ op: 'voidCharge', chargeId }],
      } as never,
      'Patient not seen',
    );
    const entries = await entriesOf(chargeId);
    expect(entries.map((e) => [e.sourceType, e.amountPaisa])).toEqual([
      [CommissionSourceType.ALLOCATION, 40_000],
      [CommissionSourceType.VOID, -40_000],
    ]);
  });

  it('old advance allocated by FIFO → entry created at allocation time', async () => {
    const A = fx.clinicA;
    const patientId = await fx.newPatient(A);
    await fx.collect(A, patientId, { amount: 5000, selections: [] }); // advance only
    // The visit happens later; its charge is paid from the old advance.
    const queueEntryId = randomUUID();
    const encounter = await fx.dataSource.getRepository(PatientEncounter).save({
      queueEntryId,
      patientId,
      organizationId: A.tenant.organizationId,
      locationId: A.tenant.locationId,
      encounterDate: new Date(),
    } as Partial<PatientEncounter>);
    await fx.dataSource.getRepository(Treatment).save({
      patientId,
      encounterId: encounter.id,
      organizationId: A.tenant.organizationId,
      locationId: A.tenant.locationId,
      treatmentName: 'Scaling',
      serviceId: scalingId,
      date: new Date(),
    } as Partial<Treatment>);
    await fx.dataSource.transaction((m) =>
      fx.sources.syncForEncounter(m, {
        tenant: A.tenant,
        queueEntryId,
        doctorId: drEmployee,
        completedAt: new Date(),
        actorUserId: A.people.doctor.userId,
      }),
    );
    const charge = await fx.dataSource
      .getRepository(Charge)
      .findOneByOrFail({ encounterId: encounter.id, serviceId: scalingId });
    expect(await amounts(charge.id)).toEqual([]);
    await fx.payments.applyAdvance(fx.ctx(A), patientId, {
      mode: AllocationMode.AUTO,
      selections: [{ chargeId: charge.id }],
    } as never);
    const entries = await entriesOf(charge.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      sourceType: CommissionSourceType.ALLOCATION,
      amountPaisa: 40_000,
    });
  });

  it('collect preview shows the doctor share to admins only, equal to what is recorded', async () => {
    const { patientId, chargeId } = await visit();
    const dto = {
      patientId,
      amount: 600,
      paymentAccountId: fx.clinicA.cashAccountId,
      applyAdvance: false,
      mode: AllocationMode.MANUAL,
      selections: [{ chargeId, amount: 600 }],
    };
    const asAdmin = await fx.payments.preview(fx.ctx(fx.clinicA, 'admin'), dto);
    const asReception = await fx.payments.preview(
      fx.ctx(fx.clinicA, 'reception'),
      dto,
    );
    expect(asReception.doctorShare).toBeNull();
    expect(asAdmin.doctorShare?.totalPaisa).toBe(24_000);
    await pay(patientId, chargeId, 600);
    expect(await amounts(chargeId)).toEqual([24_000]);
  });

  it('SALARY-only doctor → no entries', async () => {
    const dr = await newDoctor('Salaried Doc');
    await plans.create(fx.clinicA.tenant, admin, dr.assignmentId, {
      type: CompensationPlanType.SALARY,
      baseSalaryPaisa: 5_000_000,
      effectiveFrom: '2024-01-01',
    });
    const { patientId, chargeId } = await visit(dr.employeeId);
    const c = await fx.dataSource
      .getRepository(Charge)
      .findOneByOrFail({ id: chargeId });
    expect(c.commissionRateBps).toBeNull();
    await pay(patientId, chargeId, 1000);
    expect(await amounts(chargeId)).toEqual([]);
  });

  it('charge without doctor → no entries', async () => {
    const A = fx.clinicA;
    const patientId = await fx.newPatient(A);
    const charge = await fx.addCharge(A, patientId, {
      description: 'X-ray film',
      unitPrice: 500,
    });
    await pay(patientId, charge.id, 500);
    expect(await amounts(charge.id)).toEqual([]);
  });

  it('GROSS basis and fixed-amount rules', async () => {
    const dr = await newDoctor('Gross Doc');
    await plans.create(fx.clinicA.tenant, admin, dr.assignmentId, {
      type: CompensationPlanType.COMMISSION,
      defaultRateBps: 4000,
      commissionBasis: CommissionBasis.GROSS,
      effectiveFrom: '2024-01-01',
    });
    const { patientId, chargeId } = await visit(dr.employeeId);
    const res = await pay(patientId, chargeId, 500);
    const inv = await fx.invoices.detail(fx.clinicA.tenant, res.invoiceId!);
    await fx.invoices.edit(
      fx.ctx(fx.clinicA, 'admin'),
      inv.id,
      {
        expectedRevision: inv.revision,
        operations: [
          {
            op: 'setDiscount',
            chargeId,
            kind: DiscountKind.FIXED,
            value: 200,
            note: 'Staff',
          },
        ],
      } as never,
      'Staff discount',
    );
    await pay(patientId, chargeId, 300);
    // Fully paid 800 of a 1,000 gross: clinic absorbs the discount → 40% of 1,000.
    expect((await amounts(chargeId)).reduce((a, b) => a + b, 0)).toBe(40_000);

    const fixedDr = await newDoctor('Fixed Doc');
    await plans.create(fx.clinicA.tenant, admin, fixedDr.assignmentId, {
      type: CompensationPlanType.COMMISSION,
      defaultRateBps: 1000,
      effectiveFrom: '2024-01-01',
      rules: [{ serviceId: scalingId, fixedAmountPaisa: 25_000 }],
    });
    const v = await visit(fixedDr.employeeId);
    await pay(v.patientId, v.chargeId, 400);
    expect(await amounts(v.chargeId)).toEqual([10_000]); // 250 × 400/1000
  });

  it('rate changed mid-month → old charges keep their old rate', async () => {
    const dr = await newDoctor('Rate Change Doc');
    await plans.create(fx.clinicA.tenant, admin, dr.assignmentId, {
      type: CompensationPlanType.COMMISSION,
      defaultRateBps: 4000,
      effectiveFrom: '2024-01-01',
    });
    const before = await visit(dr.employeeId);
    const today = fx.clock.today('Asia/Karachi');
    await plans.create(fx.clinicA.tenant, admin, dr.assignmentId, {
      type: CompensationPlanType.COMMISSION,
      defaultRateBps: 5000,
      effectiveFrom: today,
    });
    const after = await visit(dr.employeeId);
    await pay(before.patientId, before.chargeId, 1000);
    await pay(after.patientId, after.chargeId, 1000);
    expect(await amounts(before.chargeId)).toEqual([40_000]);
    expect(await amounts(after.chargeId)).toEqual([50_000]);
    const overview = await plans.list(fx.clinicA.tenant, dr.assignmentId);
    expect(
      overview.versions.map((p) => [p.defaultRateBps, p.effectiveTo]),
    ).toEqual([
      [5000, null],
      [4000, addDays(today, -1)],
    ]);
  });

  it('rejects overlapping versions and commission for non-consulting roles', async () => {
    await expect(
      plans.create(fx.clinicA.tenant, admin, drAssignment, {
        type: CompensationPlanType.COMMISSION,
        defaultRateBps: 4000,
        effectiveFrom: '2023-01-01',
      }),
    ).rejects.toMatchObject({ code: 'COMPENSATION_PLAN_OVERLAP' });
    const receptionAssignment = await assignmentOf(
      fx.clinicA.people.reception.employeeId,
    );
    await expect(
      plans.create(fx.clinicA.tenant, admin, receptionAssignment, {
        type: CompensationPlanType.COMMISSION,
        defaultRateBps: 4000,
        effectiveFrom: '2024-01-01',
      }),
    ).rejects.toMatchObject({ code: 'COMMISSION_ROLE_CANNOT_CONSULT' });
    await expect(
      plans.create(fx.clinicA.tenant, admin, receptionAssignment, {
        type: CompensationPlanType.SALARY_PLUS_COMMISSION,
        defaultRateBps: 4000,
        effectiveFrom: '2024-01-01',
      }),
    ).rejects.toMatchObject({ code: 'COMPENSATION_PLAN_INVALID' });
  });

  describe('settlement + payroll', () => {
    let payroll: PayrollService;
    let salaryDr: { employeeId: string; assignmentId: string };
    let hybridDr: { employeeId: string; assignmentId: string };

    beforeAll(async () => {
      const A = fx.clinicA;
      const assignments = fx.dataSource.getRepository(
        EmployeeOrgLocationAssignment,
      );
      payroll = new PayrollService(
        fx.dataSource.getRepository(PayrollRecord),
        fx.dataSource.getRepository(Location),
        {
          getActiveAssignmentsByLocation: (
            locationId: string,
            organizationId: string,
          ) =>
            assignments.find({
              where: { locationId, organizationId, isActive: true },
              relations: ['employee'],
            }),
        } as never,
        fx.dataSource,
        fx.clock,
      );
      salaryDr = await newDoctor('Payroll Salary Doc');
      await plans.create(A.tenant, admin, salaryDr.assignmentId, {
        type: CompensationPlanType.SALARY,
        baseSalaryPaisa: 6_000_000,
        effectiveFrom: '2024-01-01',
      });
      hybridDr = await newDoctor('Payroll Hybrid Doc');
      await plans.create(A.tenant, admin, hybridDr.assignmentId, {
        type: CompensationPlanType.SALARY_PLUS_COMMISSION,
        baseSalaryPaisa: 3_000_000,
        defaultRateBps: 2000,
        effectiveFrom: '2024-01-01',
      });
      const v = await visit(hybridDr.employeeId);
      await pay(v.patientId, v.chargeId, 1000); // 200 commission
    });

    it('payroll generate for SALARY, COMMISSION and hybrid', async () => {
      const A = fx.clinicA;
      const [year, month] = fx.clock
        .today('Asia/Karachi')
        .split('-')
        .map(Number);
      const unsettledBefore: Array<{ s: string }> = await fx.dataSource.query(
        `SELECT COALESCE(SUM(amount_paisa), 0)::bigint AS s FROM commission_entries
          WHERE assignment_id = $1 AND settlement_id IS NULL`,
        [drAssignment],
      );
      await payroll.generate({ month, year }, A.tenant, A.people.admin.userId);
      const rec = (employeeId: string) =>
        fx.dataSource.getRepository(PayrollRecord).findOneByOrFail({
          employeeId,
          locationId: A.tenant.locationId,
          month,
          year,
        });

      const salary = await rec(salaryDr.employeeId);
      expect([
        salary.baseSalaryPaisa,
        salary.commissionPaisa,
        salary.totalPaisa,
      ]).toEqual([6_000_000, 0, 6_000_000]);

      const commissionOnly = await rec(drEmployee);
      expect(commissionOnly.baseSalaryPaisa).toBe(0);
      expect(commissionOnly.commissionPaisa).toBe(Number(unsettledBefore[0].s));
      expect(commissionOnly.totalPaisa).toBe(commissionOnly.commissionPaisa);

      const hybrid = await rec(hybridDr.employeeId);
      expect([
        hybrid.baseSalaryPaisa,
        hybrid.commissionPaisa,
        hybrid.totalPaisa,
      ]).toEqual([3_000_000, 20_000, 3_020_000]);
      expect(Number(hybrid.salaryAmount)).toBe(30_200);

      // Every settled entry points to exactly one settlement of that payroll record.
      const s = await fx.dataSource
        .getRepository(CommissionSettlement)
        .findOneByOrFail({ payrollRecordId: hybrid.id });
      expect(s.totalPaisa).toBe(20_000);
      const [{ open }]: Array<{ open: number }> = await fx.dataSource.query(
        `SELECT COUNT(*)::int AS open FROM commission_entries
          WHERE assignment_id = ANY($1::uuid[]) AND settlement_id IS NULL`,
        [[drAssignment, hybridDr.assignmentId]],
      );
      expect(open).toBe(0);

      // mark-paid on payroll also marks the settlement PAID.
      await payroll.markPaid(
        hybrid.id,
        { paymentMethod: PaymentMethod.CASH } as never,
        A.tenant.organizationId,
        A.people.admin.userId,
      );
      const paid = await fx.dataSource
        .getRepository(CommissionSettlement)
        .findOneByOrFail({ id: s.id });
      expect(paid.status).toBe(CommissionSettlementStatus.PAID);
      expect((await rec(hybridDr.employeeId)).status).toBe(PayrollStatus.PAID);
    });

    it('settled entry, then unapply → negative entry goes to the next settlement', async () => {
      const settled = await fx.dataSource
        .getRepository(CommissionEntry)
        .findOneOrFail({
          where: { assignmentId: hybridDr.assignmentId },
        });
      expect(settled.settlementId).not.toBeNull();
      const payment: Array<{ payment_id: string }> = await fx.dataSource.query(
        `SELECT payment_id FROM payment_allocations WHERE charge_id = $1 LIMIT 1`,
        [settled.chargeId],
      );
      await fx.payments.unapply(
        fx.ctx(fx.clinicA, 'admin'),
        payment[0].payment_id,
        {
          reason: 'Refund requested',
        },
      );
      const all = await entriesOf(settled.chargeId!);
      expect(all.map((e) => [e.amountPaisa, !!e.settlementId])).toEqual([
        [20_000, true],
        [-20_000, false],
      ]);
      // The reversal waits for the next period (net negative is carried, not settled now).
      const next = await fx.dataSource.transaction((m) =>
        CommissionSettlements.lockUnsettled(
          m,
          hybridDr.assignmentId,
          new Date(Date.now() + 86_400_000 * 40),
        ),
      );
      expect(next.totalPaisa).toBe(-20_000);
    });

    it('doctor earnings report and /me/earnings agree with the ledger', async () => {
      const A = fx.clinicA;
      const report = await reports.doctorEarnings(
        A.tenant,
        A.people.admin.userId,
        {},
      );
      const row = report.rows.find(
        (r) => r.assignmentId === hybridDr.assignmentId,
      )!;
      expect(row.earnedPaisa).toBe(0); // +200 −200 this month
      expect(row.settledPaisa).toBe(20_000);
      expect(row.pendingPaisa).toBe(-20_000);
      const me = await reports.myEarnings(A.tenant, A.people.doctor.userId, {});
      expect(me.rows.map((r) => r.assignmentId)).toEqual([drAssignment]);
      expect(me.entries.every((e) => e.assignmentId === drAssignment)).toBe(
        true,
      );
    });
  });
});

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
