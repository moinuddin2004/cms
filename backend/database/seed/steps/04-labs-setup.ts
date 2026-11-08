import * as bcrypt from 'bcrypt';
import { IsNull } from 'typeorm';
import { AccessResolver } from 'src/access/access.resolver';
import { CatalogServicesService } from 'src/billing/catalog/catalog.service';
import { billingContext } from 'src/billing/common/billing-context';
import { ServiceKind } from 'src/billing/enums/billing.enums';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { ProviderEnum } from 'src/auth/enum/ProviderEnum';
import { FormSchema } from 'src/engine/entities/form-schema.entity';
import { StageTemplate } from 'src/engine/entities/stage-template.entity';
import { ServiceCategory } from 'src/lab-catalog/entities/service-category.entity';
import { UnitType } from 'src/lab-catalog/enums/catalog.enums';
import { ServiceMappingsService } from 'src/lab-catalog/mappings/service-mappings.service';
import { LabServicePricesService } from 'src/lab-catalog/services/lab-service-prices.service';
import { LabServicesService } from 'src/lab-catalog/services/lab-services.service';
import { LabInvoicesService } from 'src/lab-billing/services/lab-invoices.service';
import type { ClinicCall, LabCall } from 'src/lab-orders/common/order-context';
import { clinicActorOf } from 'src/labs/common/clinic-actor';
import { LabEmailVerificationService } from 'src/labs/directory/lab-email-verification.service';
import { LabsDirectoryService } from 'src/labs/directory/labs-directory.service';
import { LabLinkStatus, LabMemberRole, LabType, PatientDataLevel } from 'src/labs/enums/lab.enums';
import { LabLinksService } from 'src/labs/links/lab-links.service';
import { LabMembersService } from 'src/labs/members/lab-members.service';
import { LabClinicLink } from 'src/labs/entities/lab-clinic-link.entity';
import { User } from 'src/user/entities/user.entity';
import { travelTo } from '../lib/time-travel';
import {
  SEED_EMAIL_DOMAIN,
  SEED_PASSWORD,
  SeedClinic,
  SeedContext,
  addDays,
  clinicActor,
  log,
  tenant,
} from '../lib/context';

/**
 * Lab management setup. Labs, their staff, services and prices are
 * platform data (super admin, `/platform/labs`); each clinic then adds the
 * lab to its lab list, maps lab services to its own treatments (patient
 * price) and sets its lab billing terms. All through the lab services.
 *
 * - Precision Dental Lab (external, Karachi) works for both dental clinics.
 * - Al-Shifa has an in-house lab (internal lab owned by the clinic).
 * - The general clinic (familycare) has lab orders switched off: no lab.
 *
 * The step leaves what the lab-orders step needs in `ctx.data.labs`.
 */

export interface SeedLabService {
  id: string;
  code: string;
  name: string;
  /** Engine form code (answers shape) or null for no form. */
  form: string | null;
  turnaroundDays: number;
}

export interface SeedLab {
  key: 'precision' | 'alshifa_inhouse';
  id: string;
  name: string;
  /** lab_admin login */
  adminUserId: string;
  /** Technicians: user + lab_members.id (for item assignment). */
  technicians: { userId: string; memberId: string }[];
  services: Record<string, SeedLabService>;
  /** clinic keys linked (active) */
  clinicKeys: string[];
}

/** The seeded labs, as `ctx.data.labs` (read by 07-lab-orders). */
export function seededLabs(ctx: SeedContext): SeedLab[] {
  return (ctx.data?.labs as SeedLab[] | undefined) ?? [];
}

// ─── Shared helpers (also used by 07-lab-orders) ────────────────────────

/** A clinic-side lab call as `userId` at a location (AccessContext resolved like a request). */
export async function clinicCall(
  ctx: SeedContext,
  clinic: SeedClinic,
  locationKey: string,
  userId: string,
): Promise<ClinicCall> {
  const t = tenant(clinic, locationKey);
  const access = await ctx.app
    .get(AccessResolver)
    .resolve(userId, t.organizationId, t.locationId);
  return { tenant: t, actor: clinicActorOf(access), ref: clinicActor(userId) };
}

/** A lab portal call as an active member of `labId`. */
export function labCall(labId: string, userId: string, role: LabMemberRole): LabCall {
  return {
    lab: { userId, labId, role },
    ref: { userId, side: ActorSide.LAB, ip: '127.0.0.1', requestId: 'seed' },
  };
}

// ─── Data ───────────────────────────────────────────────────────────────

interface ServiceDef {
  code: string;
  name: string;
  category: string;
  unitType: UnitType;
  form: string | null;
  stage: 'SINGLE_STAGE' | 'PFM_3_STAGE' | 'COMPLETE_DENTURE';
  turnaround: number;
  /** Lab price in rupees (→ minor units) */
  price: number;
  rush?: number;
  /** Clinic treatment (billing `services.code`) this lab service bills as. */
  treatment: string;
}

const PRECISION_SERVICES: ServiceDef[] = [
  { code: 'PFM_CROWN', name: 'PFM crown', category: 'CROWN', unitType: UnitType.PER_TOOTH, form: 'CROWN', stage: 'PFM_3_STAGE', turnaround: 7, price: 4500, rush: 1500, treatment: 'CROWN-PFM' },
  { code: 'ZR_CROWN', name: 'Zirconia crown (monolithic)', category: 'CROWN', unitType: UnitType.PER_TOOTH, form: 'CROWN', stage: 'SINGLE_STAGE', turnaround: 5, price: 9000, rush: 2500, treatment: 'CROWN-ZR' },
  { code: 'PFM_BRIDGE', name: 'PFM bridge (per unit)', category: 'BRIDGE', unitType: UnitType.PER_TOOTH, form: 'BRIDGE', stage: 'PFM_3_STAGE', turnaround: 8, price: 4500, treatment: 'BRIDGE-PFM' },
  { code: 'IMPLANT_CROWN', name: 'Implant crown (screw-retained zirconia)', category: 'IMPLANT', unitType: UnitType.PER_TOOTH, form: 'IMPLANT_CROWN', stage: 'SINGLE_STAGE', turnaround: 7, price: 18000, treatment: 'IMPLANT-CROWN' },
  { code: 'CD_DENTURE', name: 'Complete denture (per arch)', category: 'DENTURE', unitType: UnitType.PER_ARCH, form: 'DENTURE', stage: 'COMPLETE_DENTURE', turnaround: 12, price: 12000, treatment: 'DENTURE-CD' },
  { code: 'NIGHT_GUARD', name: 'Night guard (hard acrylic)', category: 'ORTHO', unitType: UnitType.PER_CASE, form: null, stage: 'SINGLE_STAGE', turnaround: 4, price: 2500, treatment: 'MOUTHGUARD' },
  { code: 'DENTURE_REPAIR', name: 'Denture repair', category: 'REPAIR', unitType: UnitType.PER_CASE, form: 'REPAIR', stage: 'SINGLE_STAGE', turnaround: 2, price: 1500, treatment: 'DENTURE-REPAIR' },
];

const INHOUSE_SERVICES: ServiceDef[] = [
  { code: 'PFM_CROWN', name: 'PFM crown (in-house)', category: 'CROWN', unitType: UnitType.PER_TOOTH, form: 'CROWN', stage: 'PFM_3_STAGE', turnaround: 6, price: 3200, treatment: 'CROWN-PFM' },
  { code: 'CD_DENTURE', name: 'Complete denture (in-house)', category: 'DENTURE', unitType: UnitType.PER_ARCH, form: 'DENTURE', stage: 'COMPLETE_DENTURE', turnaround: 10, price: 9000, treatment: 'DENTURE-CD' },
  { code: 'DENTURE_REPAIR', name: 'Denture repair (in-house)', category: 'REPAIR', unitType: UnitType.PER_CASE, form: 'REPAIR', stage: 'SINGLE_STAGE', turnaround: 1, price: 1000, treatment: 'DENTURE-REPAIR' },
  { code: 'NIGHT_GUARD', name: 'Night guard (in-house)', category: 'ORTHO', unitType: UnitType.PER_CASE, form: null, stage: 'SINGLE_STAGE', turnaround: 3, price: 1800, treatment: 'MOUTHGUARD' },
];

/**
 * Lab work some clinics bill that the billing catalog (data/services.ts)
 * doesn't list. Created only when missing, through CatalogServicesService.
 */
const EXTRA_TREATMENTS = [
  { code: 'BRIDGE-PFM', name: 'PFM Bridge (per unit)', price: 15000 },
  { code: 'IMPLANT-CROWN', name: 'Implant Crown (zirconia)', price: 45000 },
  { code: 'DENTURE-REPAIR', name: 'Denture Repair', price: 3500 },
  // Same codes as data/services.ts, in case the billing step didn't run.
  { code: 'CROWN-PFM', name: 'PFM Crown', price: 15000 },
  { code: 'CROWN-ZR', name: 'Zirconia Crown', price: 35000 },
  { code: 'DENTURE-CD', name: 'Complete Denture (per arch)', price: 30000 },
  { code: 'MOUTHGUARD', name: 'Night Guard', price: 8000 },
];

// ─── Step ───────────────────────────────────────────────────────────────

let passwordHash: string | null = null;

async function createLabUser(ctx: SeedContext, email: string, name: string, phone: string): Promise<User> {
  passwordHash ??= await bcrypt.hash(SEED_PASSWORD, 12);
  const repo = ctx.app.ds.getRepository(User);
  return repo.save(
    repo.create({
      email: email.toLowerCase(),
      name,
      phone,
      password: passwordHash,
      provider: ProviderEnum.LOCAL,
      emailVerifiedAt: new Date(),
    } as Partial<User>),
  );
}

export async function seedLabsSetup(ctx: SeedContext): Promise<void> {
  ctx.data.labs = [];
  const dental = ctx.clinics.filter((c) => c.kind === 'dental');
  if (!dental.length) return;
  const smilecare = dental.find((c) => c.key === 'smilecare') ?? dental[0];
  const alshifa = dental.find((c) => c.key === 'alshifa');

  // The labs come on board the day after the clinics opened.
  const setupDay = addDays(ctx.today, -ctx.historyDays - 6);
  travelTo(new Date(`${setupDay}T06:00:00Z`));
  const platform: ActorRef = { userId: ctx.superAdminId, side: ActorSide.PLATFORM, ip: '127.0.0.1', requestId: 'seed' };

  // ── External lab + its staff ────────────────────────────────────────
  const labDomain = `precisionlab.${SEED_EMAIL_DOMAIN}`;
  const precision = await createLab(ctx, platform, {
    key: 'precision',
    name: 'Precision Dental Lab',
    labType: LabType.EXTERNAL,
    phone: '02134551200',
    whatsappPhone: '03008221200',
    email: `orders@${labDomain}`,
    city: 'Karachi',
    address: 'Plot 14-C, Shahrah-e-Faisal, PECHS Block 6, Karachi',
    admin: { email: `owner@${labDomain}`, name: 'Imtiaz Qadri', phone: '03008221201' },
    technicians: [
      { email: `tech@${labDomain}`, name: 'Naveed Akhtar', phone: '03008221202' },
      { email: `ceramist@${labDomain}`, name: 'Shahid Hussain', phone: '03008221203' },
    ],
    services: PRECISION_SERVICES,
  });

  // ── Al-Shifa's in-house lab ─────────────────────────────────────────
  let inhouse: SeedLab | null = null;
  if (alshifa) {
    inhouse = await createLab(ctx, platform, {
      key: 'alshifa_inhouse',
      name: 'Al-Shifa In-house Lab',
      labType: LabType.INTERNAL,
      ownerOrganizationId: alshifa.orgId,
      phone: '04235761240',
      email: `lab@${alshifa.ownerEmail.split('@')[1]}`,
      city: 'Lahore',
      address: 'Basement, Al-Shifa Dental, DHA Phase 5, Lahore',
      admin: { email: `lab@${alshifa.ownerEmail.split('@')[1]}`, name: 'Rashid Mehmood', phone: '03214567810', role: 'Lab in-charge' },
      // The clinic's dental assistant also works the lab bench (allowed: internal lab of his clinic).
      technicianStaff: alshifa.staff.filter((s) => s.role === 'assistant' && s.userId).map((s) => s.userId!),
      services: INHOUSE_SERVICES,
      clinicName: alshifa.name,
    });
    inhouse.clinicKeys.push(alshifa.key); // linked (active) on create
  }

  // ── Clinics add the external lab and map services to treatments ─────
  for (const clinic of dental) {
    const ownerCall = await clinicCall(ctx, clinic, clinic.locations[0].key, clinic.ownerUserId);
    const ref = ownerCall.ref;
    const links = ctx.app.get(LabLinksService);
    const link = await links.create(
      clinic.orgId,
      {
        labId: precision.id,
        paymentTermsDays: clinic.key === 'smilecare' ? 30 : 15,
        patientDataLevel: clinic.key === 'smilecare' ? PatientDataLevel.FULL_NAME : PatientDataLevel.CODE_ONLY,
        notes: 'Pickup Mon/Wed/Fri by lab rider; urgent cases by TCS.',
      },
      ref,
    );
    await links.transition(clinic.orgId, link.id, { action: 'activate', version: link.version }, ref);
    precision.clinicKeys.push(clinic.key);

    const treatments = await ensureTreatments(ctx, clinic, ownerCall);
    const mappings = ctx.app.get(ServiceMappingsService);
    // In-house first at Al-Shifa: its own lab is the default for shared treatments.
    const labsForClinic = [...(inhouse && clinic.key === alshifa?.key ? [{ lab: inhouse, defs: INHOUSE_SERVICES }] : []), { lab: precision, defs: PRECISION_SERVICES }];
    for (const { lab, defs } of labsForClinic) {
      for (const def of defs) {
        await mappings.create(
          clinic.orgId,
          { clinicTreatmentId: treatments[def.treatment], labServiceId: lab.services[def.code].id },
          ref,
        );
      }
    }

    // Lab billing terms (patient lab invoices): no tax, due in 15 days.
    await ctx.app.get(LabInvoicesService).updateSettings(ownerCall, { taxRateBp: 0, dueDays: 15 });
  }

  // Negotiated price: Al-Shifa gets zirconia crowns at Rs 8,500.
  if (alshifa) {
    await ctx.app.get(LabServicePricesService).create(
      precision.id,
      precision.services.ZR_CROWN.id,
      { organizationId: alshifa.orgId, unitPriceMinor: 850_000, rushSurchargeMinor: 250_000, effectiveFrom: setupDay, notes: 'Volume rate agreed with Dr. Hassan' },
      platform,
    );
  }

  // A month ago the lab raised its PFM price (new window; old orders keep their frozen price).
  const raiseOn = addDays(ctx.today, -30);
  if (raiseOn > setupDay) {
    travelTo(new Date(`${addDays(raiseOn, -2)}T07:00:00Z`));
    await ctx.app.get(LabServicePricesService).create(
      precision.id,
      precision.services.PFM_CROWN.id,
      { unitPriceMinor: 500_000, rushSurchargeMinor: 150_000, effectiveFrom: raiseOn, notes: 'Metal cost increase' },
      platform,
    );
  }

  ctx.data.labs = [precision, ...(inhouse ? [inhouse] : [])];
  const active = await ctx.app.ds.getRepository(LabClinicLink).count({ where: { status: LabLinkStatus.ACTIVE } });
  log(`labs: ${seededLabs(ctx).map((l) => `${l.name} (${Object.keys(l.services).length} services)`).join(', ')}; ${active} active clinic links`);
}

// ─── Helpers ────────────────────────────────────────────────────────────

interface LabDef {
  key: SeedLab['key'];
  name: string;
  labType: LabType;
  ownerOrganizationId?: string;
  phone: string;
  whatsappPhone?: string;
  email: string;
  city: string;
  address: string;
  admin: { email: string; name: string; phone: string; role?: string };
  technicians?: { email: string; name: string; phone: string }[];
  /** Existing clinic users who join an internal lab as technicians. */
  technicianStaff?: string[];
  services: ServiceDef[];
  clinicName?: string;
}

async function createLab(ctx: SeedContext, platform: ActorRef, def: LabDef): Promise<SeedLab> {
  const { ds } = ctx.app;
  const directory = ctx.app.get(LabsDirectoryService);
  const members = ctx.app.get(LabMembersService);

  const lab = await directory.create(
    {
      name: def.name,
      labType: def.labType,
      ownerOrganizationId: def.ownerOrganizationId ?? null,
      phone: def.phone,
      whatsappPhone: def.whatsappPhone ?? null,
      email: def.email,
      city: def.city,
      address: def.address,
    },
    platform,
  );
  // The super admin confirmed the lab's address on the phone.
  await ctx.app.get(LabEmailVerificationService).markVerified(lab.id, ctx.superAdminId);

  const labelClinic = def.clinicName ? `${def.name} (${def.clinicName})` : def.name;
  const admin = await createLabUser(ctx, def.admin.email, def.admin.name, def.admin.phone);
  await members.add(lab.id, { email: admin.email, role: LabMemberRole.LAB_ADMIN }, platform);
  ctx.logins.push({ who: def.admin.name, email: admin.email, role: def.admin.role ?? 'Lab owner', clinic: labelClinic });

  const technicians: SeedLab['technicians'] = [];
  for (const t of def.technicians ?? []) {
    const u = await createLabUser(ctx, t.email, t.name, t.phone);
    const m = await members.add(lab.id, { email: u.email, role: LabMemberRole.LAB_TECHNICIAN }, platform);
    technicians.push({ userId: u.uuid, memberId: m.id });
    ctx.logins.push({ who: t.name, email: u.email, role: 'Lab technician', clinic: labelClinic });
  }
  for (const userId of def.technicianStaff ?? []) {
    const u = await ds.getRepository(User).findOneByOrFail({ uuid: userId });
    const m = await members.add(lab.id, { email: u.email, role: LabMemberRole.LAB_TECHNICIAN }, platform);
    technicians.push({ userId, memberId: m.id });
  }

  // Services (engine forms + stage templates seeded on boot) and list prices.
  const platformDef = { organizationId: IsNull() };
  const services: SeedLab['services'] = {};
  for (const s of def.services) {
    const category = await ds.getRepository(ServiceCategory).findOneByOrFail({ code: s.category });
    const stage = await ds.getRepository(StageTemplate).findOneByOrFail({ ...platformDef, code: s.stage });
    const form = s.form
      ? await ds.getRepository(FormSchema).findOneByOrFail({ ...platformDef, code: s.form })
      : null;
    const created = await ctx.app.get(LabServicesService).create(
      lab.id,
      {
        categoryId: category.id,
        code: s.code.toLowerCase(),
        name: s.name,
        unitType: s.unitType,
        defaultTurnaroundDays: s.turnaround,
        formSchemaId: form?.id ?? null,
        stageTemplateId: stage.id,
      },
      platform,
    );
    await ctx.app.get(LabServicePricesService).create(
      lab.id,
      created.id,
      {
        unitPriceMinor: s.price * 100,
        rushSurchargeMinor: s.rush ? s.rush * 100 : undefined,
        effectiveFrom: ctx.app.get(LabServicesService).today(),
      },
      platform,
    );
    services[s.code] = { id: created.id, code: s.code, name: s.name, form: s.form, turnaroundDays: s.turnaround };
  }

  return {
    key: def.key,
    id: lab.id,
    name: def.name,
    adminUserId: admin.uuid,
    technicians,
    services,
    clinicKeys: [],
  };
}

/** code → services.id for every treatment a lab service maps to (created if missing). */
async function ensureTreatments(
  ctx: SeedContext,
  clinic: SeedClinic,
  owner: ClinicCall,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const catalog = ctx.app.get(CatalogServicesService);
  for (const t of EXTRA_TREATMENTS) {
    let id: string | undefined = clinic.services[t.code];
    if (!id) {
      const [row] = await ctx.app.ds.query(
        `SELECT id FROM services WHERE organization_id = $1 AND code = $2`,
        [clinic.orgId, t.code],
      );
      id = row?.id;
    }
    if (!id) {
      const created = await catalog.create(billingContext(owner.tenant, owner.actor.access), {
        name: t.name,
        code: t.code,
        kind: ServiceKind.PROCEDURE,
        defaultPrice: t.price,
      });
      id = created.id;
    }
    out[t.code] = id;
  }
  return out;
}
