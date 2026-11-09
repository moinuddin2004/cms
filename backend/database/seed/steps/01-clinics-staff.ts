import * as bcrypt from 'bcrypt';
import { ClinicSetupService } from 'src/subscriptions/clinic-setup.service';
import { SubscriptionsService } from 'src/subscriptions/subscriptions.service';
import { ClinicAccessService } from 'src/clinic-access/clinic-access.service';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { AccessTemplatesService } from 'src/access/templates/access-templates.service';
import { LocationsService } from 'src/locations/locations.service';
import { EmployeesService } from 'src/employees/employees.service';
import { ScheduleService } from 'src/employees/schedule.service';
import { User } from 'src/user/entities/user.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Location } from 'src/locations/entities/location.entity';
import { LocationSettings } from 'src/locations/entities/location-settings.entity';
import { OrgFeatureFlag } from 'src/feature-flags/entities/org-feature-flag.entity';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { CompensationPlanVersions } from 'src/billing/commissions/compensation-plan-versions';
import {
  CommissionBasis,
  CompensationPlanType,
} from 'src/billing/commissions/commission.enums';
import { ActorSide } from 'src/common/audit/audit.enums';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { ProviderEnum } from 'src/auth/enum/ProviderEnum';
import { SubscriptionPlan } from 'src/common/enums/subscription-plan.enum';
import { travelTo } from '../lib/time-travel';
import {
  SEED_EMAIL_DOMAIN,
  SEED_PASSWORD,
  SeedClinic,
  SeedContext,
  SeedStaff,
  addDays,
  log,
  tenant,
} from '../lib/context';
import { CLINICS, ClinicDef, PENDING_CLINIC, StaffDef } from '../data/clinics';

const TZ = 'Asia/Karachi';

/** The platform admin's own login (everyone else uses SEED_PASSWORD). */
export const SUPER_ADMIN_EMAIL = 'moin@gmail.com';
export const SUPER_ADMIN_PASSWORD = 'moin1234';

/** Features with no provider yet / not part of the demo stay off. */
const FLAGS_OFF = new Set([
  'comms.sms',
  'comms.whatsapp',
  'billing.online_payments',
  'appointments.online_booking',
  'patients.portal',
]);
/** Dental-only features, off for a general clinic. */
const DENTAL_ONLY = new Set(['patients.teeth_chart', 'dental.lab_orders', 'dental.before_after']);

let passwordHash: string | null = null;
async function hash(): Promise<string> {
  passwordHash ??= await bcrypt.hash(SEED_PASSWORD, 12);
  return passwordHash;
}

async function createUser(
  ctx: SeedContext,
  email: string,
  name: string,
  phone: string | null,
  globalRole: GlobalRole | null = null,
  password?: string,
): Promise<User> {
  const repo = ctx.app.ds.getRepository(User);
  return repo.save(
    repo.create({
      email: email.toLowerCase(),
      name,
      phone,
      password: password ? await bcrypt.hash(password, 12) : await hash(),
      provider: ProviderEnum.LOCAL,
      globalRole,
      emailVerifiedAt: new Date(),
    } as Partial<User>),
  );
}

export async function seedPlatform(ctx: SeedContext): Promise<void> {
  const admin = await createUser(
    ctx,
    SUPER_ADMIN_EMAIL,
    'Platform Admin',
    '03000000001',
    GlobalRole.SUPER_ADMIN,
    SUPER_ADMIN_PASSWORD,
  );
  ctx.superAdminId = admin.uuid;
  ctx.logins.push({ who: 'Platform Admin', email: admin.email, role: 'Super admin' });
  log('super admin created');
}

export async function seedClinics(ctx: SeedContext): Promise<void> {
  // The clinics "opened" a week before the history starts.
  travelTo(new Date(`${addDays(ctx.today, -ctx.historyDays - 7)}T05:00:00Z`));

  for (const def of CLINICS) {
    ctx.clinics.push(await seedClinic(ctx, def));
    log(`clinic ${def.name}: ${ctx.clinics.at(-1)!.staff.length} staff`);
  }
  await seedPendingClinic(ctx);
}

async function seedClinic(ctx: SeedContext, def: ClinicDef): Promise<SeedClinic> {
  const { ds } = ctx.app;
  const platform = { userId: ctx.superAdminId, side: ActorSide.PLATFORM };

  // 1. Owner signs up → clinic + main location + ownership (pending approval).
  const ownerEmail = `owner@${def.domain}`;
  const owner = await createUser(ctx, ownerEmail, def.owner.name, def.owner.phone);
  const { organizationId, locationId } = await ctx.app
    .get(ClinicSetupService)
    .createClinicForOwner(owner, { clinicName: def.name, phone: def.phone });
  ctx.logins.push({ who: def.owner.name, email: ownerEmail, role: 'Owner', clinic: def.name });

  // 2. Super admin approves it and records a subscription payment.
  await ctx.app
    .get(ClinicAccessService)
    .decideApproval(organizationId, { decision: 'approve' }, platform);
  await ctx.app.get(SubscriptionsService).recordPayment(
    organizationId,
    {
      plan: def.plan as SubscriptionPlan,
      months: 12,
      amount: def.plan === 'professional' ? 60000 : 30000,
      method: 'bank_transfer',
      reference: `IBFT-${def.key.toUpperCase()}-001`,
      notes: 'Annual plan (seed)',
    },
    platform,
  );
  await ds.getRepository(Organization).update(organizationId, {
    onboardingPending: false,
    specialtyTags: def.specialtyTags,
    clinicType: def.clinicType,
    website: def.website ?? null,
    email: `info@${def.domain}`,
  });

  // 3. Locations: the main one from signup, the rest through LocationsService.
  const locRepo = ds.getRepository(Location);
  const locations: SeedClinic['locations'] = [];
  for (const l of def.locations) {
    const fields = {
      name: l.name,
      code: l.code,
      tokenPrefix: l.tokenPrefix,
      address: l.address,
      city: l.city,
      state: l.state,
      country: 'Pakistan',
      phone: l.phone,
      email: `${l.key}@${def.domain}`,
      timezone: TZ,
      currency: 'PKR',
      totalChairs: l.totalChairs,
      isMainBranch: l.isMain,

    };
    let id: string;
    if (l.isMain) {
      id = locationId;
      await locRepo.update(id, fields);
    } else {
      id = (await ctx.app.get(LocationsService).create(organizationId, fields as any, owner.uuid)).id;
    }
    await ds
      .getRepository(LocationSettings)
      .update({ locationId: id }, { taxRate: l.taxRate, appointmentSlotDuration: 30 });
    locations.push({ key: l.key, id, name: l.name, timezone: TZ });
  }

  // 4. Features: everything on (entitled + enabled) except the ones without a provider.
  await ctx.app.get(FeatureFlagsService).seedFlagsForOrg(organizationId);
  await ctx.app.get(AccessTemplatesService).seedForOrg(organizationId);
  const flagRepo = ds.getRepository(OrgFeatureFlag);
  for (const f of await flagRepo.find({ where: { organizationId } })) {
    const on =
      !FLAGS_OFF.has(f.featureKey) &&
      !(def.kind === 'general' && DENTAL_ONLY.has(f.featureKey));
    await flagRepo.update(f.id, {
      isEntitled: on,
      isEnabled: on,
      entitledBy: ctx.superAdminId,
      enabledBy: owner.uuid,
    });
  }
  (ctx.app.get(FeatureFlagsService) as any).invalidateCache(organizationId);

  const roles = await ds.getRepository(EmploymentRole).find({ where: { organizationId } });
  const roleIds: Record<string, string> = {};
  for (const r of roles) if (r.templateKey) roleIds[r.templateKey] = r.id;

  const clinic: SeedClinic = {
    key: def.key,
    kind: def.kind,
    orgId: organizationId,
    name: def.name,
    ownerUserId: owner.uuid,
    ownerEmail,
    locations,
    roles: roleIds,
    staff: [],
    patients: [],
    services: {},
  };

  // 5. Staff (the owner first when they also practise).
  if (def.owner.alsoDoctor) {
    clinic.staff.push(
      await seedStaff(ctx, clinic, def, {
        ...def.owner.alsoDoctor,
        key: 'owner',
        name: def.owner.name,
        gender: def.owner.gender,
        phone: def.owner.phone,
        role: 'doctor',
      }, owner),
    );
  }
  for (const s of def.staff) clinic.staff.push(await seedStaff(ctx, clinic, def, s));
  return clinic;
}

function operatingHours() {
  const open = { isOpen: true, open: '09:00', close: '21:00' };
  return {
    monday: open, tuesday: open, wednesday: open, thursday: open,
    friday: { isOpen: true, open: '09:00', close: '21:00' },
    saturday: open,
    sunday: { isOpen: false, open: null, close: null },
  };
}

async function seedStaff(
  ctx: SeedContext,
  clinic: SeedClinic,
  def: ClinicDef,
  s: StaffDef,
  linkUser?: User,
): Promise<SeedStaff> {
  const { ds } = ctx.app;
  const employees = ctx.app.get(EmployeesService);
  const [primaryKey, ...otherKeys] = s.locations;
  const t = tenant(clinic, primaryKey);
  const roleId = s.role ? clinic.roles[s.role] : undefined;
  const email = linkUser ? linkUser.email : s.email ? `${s.email}@${def.domain}` : null;

  const compensation = compensationFor(s);
  const created = await employees.create(
    t,
    {
      fullName: s.name,
      phone: s.phone,
      cnic: s.cnic,
      gender: s.gender as any,
      dob: s.dob,
      designation: s.designation,
      employmentRoleId: roleId,
      employmentType: s.employmentType ?? 'full_time',
      joiningDate: s.joiningDate,
      hasPortalAccess: !!email,
      portalEmail: linkUser ? undefined : (email ?? undefined),
      portalPassword: linkUser ? undefined : SEED_PASSWORD,
      portalLoginMethod: 'password',
      isPrimary: true,
      compensation: compensation ? { ...compensation, effectiveFrom: s.joiningDate } : undefined,
      grossSalary: compensation ? undefined : (s.salary ?? 0),
    } as any,
    clinic.ownerUserId,
    { linkUserId: linkUser?.uuid },
  );
  const employeeId: string = created.id ?? created.employee?.id;

  const assignRepo = ds.getRepository(EmployeeOrgLocationAssignment);
  const primary = await assignRepo.findOneOrFail({
    where: { employeeId, locationId: t.locationId },
    relations: { employmentRole: true },
  });
  const assignments: Record<string, string> = { [primaryKey]: primary.id };

  // Extra locations: same login and role, own assignment + compensation.
  for (const [i, key] of otherKeys.entries()) {
    const loc = clinic.locations.find((l) => l.key === key)!;
    await ds.transaction(async (m) => {
      const extra = await m.save(
        m.create(EmployeeOrgLocationAssignment, {
          employeeId,
          organizationId: clinic.orgId,
          locationId: loc.id,
          designation: s.designation,
          employmentRoleId: roleId ?? null,
          employmentType: (s.employmentType ?? 'full_time') as any,
          employeeCode: `${primary.employeeCode}-${i + 2}`,
          joiningDate: new Date(`${s.joiningDate}T00:00:00Z`),
          hasPortalAccess: primary.hasPortalAccess,
          userId: primary.userId,
          isPrimary: false,
          createdBy: clinic.ownerUserId,
        }),
      );
      await CompensationPlanVersions.add(
        m,
        { ...extra, employmentRole: primary.employmentRole },
        {
          type: CompensationPlanType.SALARY,
          baseSalaryMinor: 0,
          effectiveFrom: s.joiningDate,
        },
        clinic.ownerUserId,
      );
      assignments[key] = extra.id;
    });
  }

  if (primary.userId) {
    await ds.getRepository(User).update(primary.userId, {
      emailVerifiedAt: new Date(),
      phone: s.phone,
      lastAccessedOrganizationId: clinic.orgId,
      lastAccessedLocationId: t.locationId,
    });
  }
  if (email && !linkUser) {
    ctx.logins.push({
      who: s.name,
      email,
      role: s.role ? s.role[0].toUpperCase() + s.role.slice(1) : '-',
      clinic: clinic.name,
    });
  }

  // Weekly schedule per location. A doctor at two branches alternates days.
  const schedule: SeedStaff['schedule'] = {};
  if (s.days && s.hours) {
    for (const [i, key] of s.locations.entries()) {
      const days =
        s.locations.length > 1
          ? s.days.filter((_, idx) => idx % s.locations.length === i)
          : s.days;
      schedule[key] = { days, start: s.hours[0], end: s.hours[1] };
      await ctx.app.get(ScheduleService).setSchedule(
        employeeId,
        {
          slotDuration: 30,
          schedule: [0, 1, 2, 3, 4, 5, 6].map((d) =>
            days.includes(d)
              ? { dayOfWeek: d, isWorking: true, startTime: s.hours![0], endTime: s.hours![1] }
              : { dayOfWeek: d, isWorking: false },
          ),
        },
        tenant(clinic, key),
        clinic.ownerUserId,
      );
    }
  }

  return {
    key: s.key,
    name: s.name,
    employeeId,
    userId: primary.userId,
    email,
    role: s.role,
    designation: s.designation,
    isDoctor: s.role === 'doctor',
    assignments,
    specialty: s.specialty,
    schedule,
  };
}

function compensationFor(s: StaffDef) {
  if (!s.commissionPct) return null;
  return {
    type: s.salary ? CompensationPlanType.SALARY_PLUS_COMMISSION : CompensationPlanType.COMMISSION,
    baseSalaryMinor: s.salary ? s.salary * 100 : undefined,
    defaultRateBps: s.commissionPct * 100,
    commissionBasis: CommissionBasis.NET,
  };
}

/** A clinic that signed up and is still waiting for approval (approval screen demo). */
async function seedPendingClinic(ctx: SeedContext): Promise<void> {
  travelTo(new Date(`${addDays(ctx.today, -2)}T07:00:00Z`));
  const owner = await createUser(
    ctx,
    PENDING_CLINIC.email,
    PENDING_CLINIC.ownerName,
    PENDING_CLINIC.phone,
  );
  await ctx.app
    .get(ClinicSetupService)
    .createClinicForOwner(owner, { clinicName: PENDING_CLINIC.name, phone: PENDING_CLINIC.phone });
  ctx.logins.push({
    who: PENDING_CLINIC.ownerName,
    email: PENDING_CLINIC.email,
    role: 'Owner (clinic pending approval)',
    clinic: PENDING_CLINIC.name,
  });
}

