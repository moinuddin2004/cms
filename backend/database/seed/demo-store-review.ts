/**
 * `npm run seed:demo -- --allow-demo-seed` — the store-review demo clinic (M4-03).
 *
 * Creates ONE approved, obviously fictional clinic ("Demo Family Clinic") with
 * one location, an owner, a doctor and a receptionist (staff logins), five
 * demo patients, a few appointments, one patient waiting in the queue, a
 * prescription, and a demo PATIENT-app account already linked to one patient.
 *
 * Safe to re-run: every piece is looked up first and only missing pieces are
 * created. Never runs on startup. Refuses without --allow-demo-seed (and, with
 * NODE_ENV=production, without --allow-demo-seed-in-production as well).
 * Credentials come from env (DEMO_STAFF_PASSWORD, DEMO_PATIENT_EMAIL — see
 * mobile-app/docs/RELEASE.md); nothing secret is printed.
 *
 * The patient app signs in with an emailed 6-digit code, so DEMO_PATIENT_EMAIL
 * must be a mailbox the owner controls (Play reviewers get the code from you).
 */
import 'src/bootstrap/utc';
import * as bcrypt from 'bcrypt';
import { assertDemoSeedAllowed, DemoSeedConfig } from 'src/demo-seed/demo-seed-guard';
import { ClinicSetupService } from 'src/subscriptions/clinic-setup.service';
import { SubscriptionsService } from 'src/subscriptions/subscriptions.service';
import { ClinicAccessService } from 'src/clinic-access/clinic-access.service';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { AccessTemplatesService } from 'src/access/templates/access-templates.service';
import { EmployeesService } from 'src/employees/employees.service';
import { ScheduleService } from 'src/employees/schedule.service';
import { PatientsService } from 'src/patients/patients.service';
import { AppointmentsService } from 'src/appointments/appointments.service';
import { QueueOrchestrator } from 'src/queue/services/queue-orchestrator.service';
import { queueActorFrom } from 'src/queue/queue-actor';
import { AccessResolver } from 'src/access/access.resolver';
import { PrescriptionService } from 'src/prescriptions/services/prescription.service';
import { User } from 'src/user/entities/user.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Location } from 'src/locations/entities/location.entity';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { OrgFeatureFlag } from 'src/feature-flags/entities/org-feature-flag.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { Prescription } from 'src/prescriptions/entities/prescription.entity';
import { PatientAccount } from 'src/patient-auth/entities/patient-account.entity';
import { PatientAccountIdentity } from 'src/patient-auth/entities/patient-account-identity.entity';
import { PatientProfile } from 'src/patient-app/entities/patient-profile.entity';
import { PatientRecordLink } from 'src/patient-app/entities/patient-record-link.entity';
import { SubscriptionPayment } from 'src/subscriptions/entities/subscription-payment.entity';
import { ClinicApprovalStatus } from 'src/common/enums/clinic-approval-status.enum';
import { planDemoClinic, staffAction } from 'src/demo-seed/demo-seed-plan';
import { ActorSide } from 'src/common/audit/audit.enums';
import { ProviderEnum } from 'src/auth/enum/ProviderEnum';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { SubscriptionPlan } from 'src/common/enums/subscription-plan.enum';
import { addDays, localDate, zonedTimeToUtc } from 'src/common/clock/tz.util';
import { bootSeedApp, SeedApp } from './lib/seed-app';

const TZ = 'Asia/Karachi';
const CLINIC_NAME = 'Demo Family Clinic (store review)';
const FEATURES_OFF = new Set([
  'comms.sms',
  'comms.whatsapp',
  'billing.online_payments',
  'appointments.online_booking',
  'patients.portal',
]);

// eslint-disable-next-line no-console
const log = (m: string) => console.log(`[demo-seed] ${m}`);

/** Obviously fictional: an all-zero subscriber number after the 0300 prefix (the app only requires a non-empty phone). */
const DEMO_PHONES = { owner: '03000000100', doctor: '03000000110', desk: '03000000111' };

const DEMO_PATIENTS = [
  { name: 'Demo Patient One', gender: 'female', dob: '1990-04-12', phone: '03000000101' },
  { name: 'Demo Patient Two', gender: 'male', dob: '1984-09-30', phone: '03000000102' },
  { name: 'Demo Patient Three', gender: 'female', dob: '1975-01-22', phone: '03000000103' },
  { name: 'Demo Patient Four', gender: 'male', dob: '2001-07-05', phone: '03000000104' },
  { name: 'Demo Patient Five', gender: 'female', dob: '1996-11-18', phone: '03000000105' },
] as const;

async function main() {
  // Guard first: nothing (not even a DB connection) happens without the flags.
  const cfg = assertDemoSeedAllowed(process.argv.slice(2), process.env);
  const app = await bootSeedApp();
  try {
    await run(app, cfg);
  } finally {
    await app.close();
  }
}

async function run(app: SeedApp, cfg: DemoSeedConfig) {
  const { ds } = app;
  const users = ds.getRepository(User);
  const emailOf = (local: string) => `${local}@${cfg.domain}`;
  const hash = await bcrypt.hash(cfg.staffPassword, 12);

  // Platform actor (approval needs one).
  const superAdmin = await users.findOne({ where: { globalRole: GlobalRole.SUPER_ADMIN } });
  const platform = { userId: superAdmin?.uuid ?? null, side: ActorSide.PLATFORM };

  // ── Clinic + owner (each piece is checked, so a half-finished run resumes) ──
  const orgRepo = ds.getRepository(Organization);
  let owner = await users.findOne({ where: { email: emailOf('owner') } });
  let org = await orgRepo.findOne({ where: { name: CLINIC_NAME } });
  const plan = planDemoClinic({
    ownerExists: !!owner,
    orgExists: !!org,
    orgApproved: org?.approvalStatus === ClinicApprovalStatus.APPROVED,
    paymentRecorded: org
      ? (await ds.getRepository(SubscriptionPayment).count({ where: { organizationId: org.id } })) > 0
      : false,
  });

  if (plan.createOwner) {
    owner = await users.save(
      users.create({
        email: emailOf('owner'),
        name: 'Demo Owner',
        phone: DEMO_PHONES.owner,
        password: hash,
        provider: ProviderEnum.LOCAL,
        globalRole: null,
        emailVerifiedAt: new Date(),
      } as Partial<User>),
    );
  }
  if (!owner) throw new Error('unreachable: owner missing');

  let orgId: string;
  let locationId: string;
  if (plan.createClinic) {
    const created = await app
      .get(ClinicSetupService)
      .createClinicForOwner(owner, { clinicName: CLINIC_NAME, phone: DEMO_PHONES.owner });
    orgId = created.organizationId;
    locationId = created.locationId;
    await orgRepo.update(orgId, { onboardingPending: false, clinicType: 'general' } as any);
    await ds.getRepository(Location).update(locationId, {
      name: 'Demo Main Branch',
      timezone: TZ,
      currency: 'PKR',
      city: 'Karachi',
      country: 'Pakistan',
    } as any);
    log('clinic created');
  } else {
    orgId = org!.id;
    locationId = (
      await ds.getRepository(Location).findOneOrFail({ where: { organizationId: orgId } })
    ).id;
    log('clinic already exists: reusing');
  }
  if (plan.approve) {
    await app
      .get(ClinicAccessService)
      .decideApproval(orgId, { decision: 'approve' }, platform as any);
  }
  if (plan.recordPayment) {
    await app.get(SubscriptionsService).recordPayment(
      orgId,
      {
        plan: 'starter' as SubscriptionPlan,
        months: 12,
        amount: 0,
        method: 'other',
        reference: 'DEMO-STORE-REVIEW',
        notes: 'Demo clinic (store review)',
      } as any,
      platform as any,
    );
  }
  // Every run: both calls insert only what is missing, and the flag pass is idempotent.
  await app.get(FeatureFlagsService).seedFlagsForOrg(orgId);
  await app.get(AccessTemplatesService).seedForOrg(orgId);
  const flags = ds.getRepository(OrgFeatureFlag);
  for (const f of await flags.find({ where: { organizationId: orgId } })) {
    const on = !FEATURES_OFF.has(f.featureKey) && !f.featureKey.startsWith('dental.');
    if (f.isEntitled !== on || f.isEnabled !== on) {
      await flags.update(f.id, { isEntitled: on, isEnabled: on, enabledBy: owner.uuid } as any);
    }
  }
  (app.get(FeatureFlagsService) as any).invalidateCache(orgId);
  const t = { organizationId: orgId, locationId };


  // ── Staff ─────────────────────────────────────────────────────────────
  const roles = await ds.getRepository(EmploymentRole).find({ where: { organizationId: orgId } });
  const roleId = (k: string) => roles.find((r) => r.templateKey === k)?.id;
  const employees = app.get(EmployeesService);
  const assign = ds.getRepository(EmployeeOrgLocationAssignment);

  async function ensureStaff(
    local: string,
    name: string,
    role: 'doctor' | 'receptionist',
    phone: string,
  ) {
    const email = emailOf(local);
    const existing = await users.findOne({ where: { email } });
    const prior = existing
      ? await assign.findOne({ where: { organizationId: orgId, userId: existing.uuid } })
      : null;
    if (staffAction({ userExists: !!existing, hasAssignment: !!prior }) === 'reuse') {
      return { userId: existing!.uuid, employeeId: prior!.employeeId, created: false };
    }
    if (existing) {
      // A login with this email exists but has no assignment at the demo clinic (a run that
      // stopped half-way). Creating the employee again would fail on the duplicate email.
      throw new Error(
        `demo user ${email} exists without a demo-clinic assignment: delete that user, then re-run the seed`,
      );
    }
    const created: any = await employees.create(
      t,
      {
        fullName: name,
        phone,
        cnic: '00000-0000000-0',
        gender: role === 'doctor' ? 'female' : 'male',
        dob: '1990-01-01',
        designation: role === 'doctor' ? 'Doctor' : 'Receptionist',
        employmentRoleId: roleId(role),
        employmentType: 'full_time',
        joiningDate: '2026-01-01',
        hasPortalAccess: true,
        portalEmail: email,
        portalPassword: cfg.staffPassword,
        portalLoginMethod: 'password',
        isPrimary: true,
        grossSalary: 0,
      } as any,
      owner!.uuid,
    );
    const employeeId: string = created.id ?? created.employee?.id;
    const a = await assign.findOneOrFail({ where: { employeeId, locationId } });
    await users.update(a.userId!, {
      emailVerifiedAt: new Date(),
      phone,
      lastAccessedOrganizationId: orgId,
      lastAccessedLocationId: locationId,
    } as any);
    return { userId: a.userId!, employeeId, created: true };
  }

  const doctor = await ensureStaff('doctor', 'Dr. Demo Doctor', 'doctor', DEMO_PHONES.doctor);
  const desk = await ensureStaff('reception', 'Demo Receptionist', 'receptionist', DEMO_PHONES.desk);
  {
    // Every run: setting the same weekly schedule again is harmless and repairs a half-finished run.
    await app.get(ScheduleService).setSchedule(
      doctor.employeeId,
      {
        slotDuration: 30,
        schedule: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
          dayOfWeek: d,
          isWorking: true,
          startTime: '09:00',
          endTime: '21:00',
        })),
      } as any,
      t,
      owner.uuid,
    );
  }
  log('staff ready (owner, doctor, receptionist)');

  // ── Patients ──────────────────────────────────────────────────────────
  const patientSvc = app.get(PatientsService);
  const actor = {
    userId: desk.userId,
    side: ActorSide.CLINIC,
    ip: '127.0.0.1',
    requestId: 'demo-seed',
  };
  const patients: Patient[] = [];
  for (const p of DEMO_PATIENTS) {
    let row = await ds
      .getRepository(Patient)
      .findOne({ where: { organizationId: orgId, phone: p.phone } });
    if (!row) {
      row = (await patientSvc.create(
        t,
        {
          fullName: p.name,
          phone: p.phone,
          dob: p.dob,
          gender: p.gender,
          city: 'Karachi',
          address: 'Demo address, Karachi',
          preferredLanguage: 'english',
          communicationPref: 'call',
          source: 'walk_in',
          isMinor: false,
          primaryLocationId: locationId,
        } as any,
        actor as any,
      )) as unknown as Patient;
    }
    patients.push(row);
  }
  log(`${patients.length} demo patients ready`);

  // ── Appointments, queue, prescription (each best effort, each skipped when present) ──
  const appts = app.get(AppointmentsService);
  const resolver = app.get(AccessResolver);
  const today = localDate(TZ, new Date());
  const slot = (daysAhead: number, hhmm: string) =>
    zonedTimeToUtc(TZ, addDays(today, daysAhead), hhmm).toISOString();
  const apptPlan: Array<[number, number, string, string]> = [
    [0, 1, '10:00', 'Demo follow-up visit'],
    [1, 2, '11:00', 'Demo check-up'],
    [2, 3, '12:00', 'Demo consultation'],
  ];
  for (const [i, daysAhead, hhmm, reason] of apptPlan) {
    const patient = patients[i];
    const has = await ds
      .getRepository(Appointment)
      .count({ where: { organizationId: orgId, patientId: patient.id } });
    if (has) continue;
    try {
      const a = await appts.create(
        t,
        {
          patientId: patient.id,
          doctorId: doctor.employeeId,
          startTime: slot(daysAhead, hhmm),
          duration: 30,
          type: 'consultation',
          reasonForVisit: reason,
        } as any,
        desk.userId,
      );
      await appts.confirm(a.id, t, desk.userId);
    } catch (e) {
      log(`appointment for ${patient.fullName} skipped: ${(e as Error).message}`);
    }
  }

  const walkIn = patients[3];
  try {
    const queued = await ds.query(
      `SELECT 1 FROM queue_entries WHERE organization_id = $1 AND patient_id = $2 LIMIT 1`,
      [orgId, walkIn.id],
    );
    if (!queued.length) {
      const access = await resolver.resolve(desk.userId, orgId, locationId);
      await app.get(QueueOrchestrator).registerWalkIn(
        t,
        queueActorFrom(access),
        { doctorId: doctor.employeeId, patientId: walkIn.id, reasonForVisit: 'Demo walk-in' } as any,
        null,
      );
      log('one demo patient is waiting in the queue');
    }
  } catch (e) {
    log(`queue entry skipped: ${(e as Error).message}`);
  }

  const linked = patients[0];
  const rxRepo = ds.getRepository(Prescription);
  if (!(await rxRepo.count({ where: { organizationId: orgId, patientId: linked.id } }))) {
    try {
      const docAccess = await resolver.resolve(doctor.userId, orgId, locationId);
      const rxSvc = app.get(PrescriptionService);
      const rx = await rxSvc.create(
        t,
        {
          patientId: linked.id,
          doctorId: doctor.employeeId,
          diagnosis: 'Demo diagnosis (sample data)',
          chiefComplaint: 'Demo complaint',
          instructionsEnglish: 'Sample data for app review. Not medical advice.',
          medicines: [
            { medicineName: 'Demo Medicine A', type: 'TABLET', dosage: '1 tablet', frequency: 'Twice daily', frequencyTiming: [], mealRelation: 'AFTER_MEAL', duration: '5 days', sortOrder: 0 },
            { medicineName: 'Demo Medicine B', type: 'SYRUP', dosage: '5 ml', frequency: 'Once daily', frequencyTiming: [], mealRelation: 'NONE', duration: '3 days', sortOrder: 1 },
          ],
        } as any,
        doctor.employeeId,
        docAccess,
      );
      await rxSvc.finalize(rx.id, orgId, {}, doctor.employeeId);
      log('demo prescription created');
    } catch (e) {
      log(`prescription skipped: ${(e as Error).message}`);
    }
  }

  // ── Demo PATIENT-app account, linked to "Demo Patient One" ────────────
  await ds.transaction(async (m) => {
    let account = await m.findOne(PatientAccount, { where: { email: cfg.patientEmail } });
    if (!account) {
      account = await m.save(
        m.create(PatientAccount, {
          fullName: linked.fullName,
          email: cfg.patientEmail,
          emailVerifiedAt: new Date(),
          phone: null,
          phoneVerifiedAt: null,
          status: 'active',
          deletedAt: null,
        }),
      );
      await m.save(
        m.create(PatientAccountIdentity, {
          accountId: account.id,
          provider: 'email',
          subject: cfg.patientEmail,
        }),
      );
    }
    let profile = await m.findOne(PatientProfile, {
      where: { accountId: account.id, relation: 'self' },
    });
    if (!profile) {
      profile = await m.save(
        m.create(PatientProfile, {
          accountId: account.id,
          relation: 'self',
          fullName: linked.fullName,
          dob: (linked as any).dob ?? null,
          gender: ((linked as any).gender as any) ?? null,
          privateReminders: false,
        }),
      );
    }
    const link = await m.findOne(PatientRecordLink, {
      where: { patientId: linked.id, status: 'active' },
    });
    if (!link) {
      const saved = await m.save(
        m.create(PatientRecordLink, {
          profileId: profile.id,
          organizationId: orgId,
          patientId: linked.id,
          status: 'active',
          linkMethod: 'staff_qr',
          verifiedByUserId: desk.userId,
          verifiedAt: new Date(),
        }),
      );
      await m.query(
        `INSERT INTO patient_account_consents (account_id, kind, version, organization_id)
         VALUES ($1, 'link', 'v1', $2)`,
        [account.id, orgId],
      );
      await m.query(
        `INSERT INTO patient_access_log
           (account_id, profile_id, organization_id, patient_id, action, resource_type, resource_id)
         VALUES ($1, $2, $3, $4, 'link', 'link', $5)`,
        [account.id, profile.id, orgId, linked.id, saved.id],
      );
    } else if (link.profileId !== profile.id) {
      log('WARNING: the demo patient is linked to a different account; left unchanged.');
    }
  });
  log('demo patient-app account linked to "Demo Patient One"');

  // Never print passwords or the patient mailbox.
  log(`done. Staff logins owner@ / doctor@ / reception@ on ${cfg.domain} (password = DEMO_STAFF_PASSWORD).`);
  log('Patient app: sign in with the DEMO_PATIENT_EMAIL mailbox (emailed code).');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[demo-seed] FAILED:', err?.message ?? err);
  process.exit(1);
});
