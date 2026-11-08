import { PatientsService } from 'src/patients/patients.service';
import { travelTo } from '../lib/time-travel';
import {
  SeedClinic,
  SeedContext,
  addDays,
  clinicActor,
  deskUserId,
  doctors,
  log,
  tenant,
} from '../lib/context';
import { PATIENTS, PatientDef } from '../data/patients';

/**
 * Patients register during the first weeks of the history (each on the day
 * of their first visit — `SeedPatient.registeredOn`), through
 * PatientsService, so numbers (P-0001…) and audit rows are real.
 */
export async function seedPatients(ctx: SeedContext): Promise<void> {
  for (const clinic of ctx.clinics) {
    const defs = PATIENTS[clinic.key] ?? [];
    for (const [i, def] of defs.entries()) {
      // Spread registrations over the first ~half of the history.
      const day = addDays(ctx.today, -ctx.historyDays + Math.floor((i * ctx.historyDays) / (defs.length * 2)));
      const at = new Date(`${day}T05:${String(10 + i).padStart(2, '0')}:00Z`); // ~10:10 PKT
      travelTo(at);
      await seedPatient(ctx, clinic, def, day, at.toISOString());
    }
    log(`${clinic.name}: ${clinic.patients.length} patients`);
  }
}

async function seedPatient(
  ctx: SeedContext,
  clinic: SeedClinic,
  def: PatientDef,
  registeredOn: string,
  registeredAt: string,
): Promise<void> {
  const svc = ctx.app.get(PatientsService);
  const locKey = def.loc ?? clinic.locations[0].key;
  const t = tenant(clinic, locKey);
  const desk = deskUserId(clinic, locKey);
  const actor = clinicActor(desk);
  const minor = !!def.guardian;
  const urduName = /[؀-ۿ]/.test(def.name);

  const p = await svc.create(
    t,
    {
      fullName: def.name,
      phone: def.phone,
      whatsappNumber: def.phone,
      dob: def.dob,
      gender: def.gender,
      bloodGroup: def.blood,
      maritalStatus: minor ? undefined : def.marital,
      occupation: def.occupation,
      cnic: minor ? undefined : cnicFor(def),
      email: def.lang === 'english' ? emailFor(def.name) : undefined,
      address: `${def.area}, ${def.city}`,
      city: def.city,
      preferredLanguage: def.lang ?? (urduName ? 'urdu' : ctx.rng.pick(['urdu', 'english'])),
      communicationPref: ctx.rng.pick(['whatsapp', 'whatsapp', 'call', 'sms']),
      source: def.source ?? 'walk_in',
      referredByText: def.source === 'referral' ? ctx.rng.pick(['Friend', 'Family member', 'Dr. reference', 'Existing patient']) : undefined,
      isMinor: minor,
      guardianName: def.guardian?.name,
      guardianPhone: def.guardian?.phone,
      guardianRelation: def.guardian?.relation,
      medicalHistory: def.history,
      allergies: def.allergies,
      emergencyContactName: def.guardian?.name ?? ctx.rng.pick(['Spouse', 'Brother', 'Son', 'Daughter', 'Father']),
      emergencyContactPhone: def.guardian?.phone ?? `0300${String(ctx.rng.int(1000000, 9999999))}`,
      emergencyContactRelation: def.guardian?.relation ?? 'Family',
      tags: def.tags ?? [],
      primaryLocationId: t.locationId,
    } as any,
    actor,
  );

  clinic.patients.push({
    id: p.id,
    name: def.name,
    phone: def.phone,
    gender: def.gender,
    locationKey: locKey,
    patientNumber: p.patientNumber,
    registeredOn,
    registeredAt,
    isMinor: minor,
  });

  // ── Clinical background ──────────────────────────────────────────
  const doc = doctors(clinic, locKey)[0] ?? doctors(clinic)[0];
  const docUser = doc?.userId ?? clinic.ownerUserId;

  if (clinic.kind === 'dental') {
    await svc.upsertDentalInfo(
      p.id,
      t,
      {
        lastDentalCheckup: addDays(registeredOn, -ctx.rng.int(200, 900)),
        gumCondition: ctx.rng.pick(['healthy', 'healthy', 'mild_gingivitis', 'moderate_gingivitis']),
        teethSensitivity: ctx.rng.chance(0.4),
        sensitivityNotes: ctx.rng.chance(0.3) ? 'Sensitive to cold drinks' : undefined,
        brushingFrequency: ctx.rng.pick(['once_daily', 'twice_daily', 'twice_daily', 'irregular']),
        flossingFrequency: ctx.rng.pick(['never', 'occasionally', 'daily']),
        smokingStatus: def.gender === 'male' && ctx.rng.chance(0.3),
        tobaccoChewing: ctx.rng.chance(0.1),
        orthodonticHistory: (def.tags ?? []).includes('ortho'),
        previousExtractions: ctx.rng.chance(0.4) ? 'Lower molar extracted a few years ago' : undefined,
        dentistNotes: 'Recorded at registration',
      } as any,
      actor,
    );
  }

  // Consent at registration (dental: general treatment; general clinic: general).
  await svc.createConsent(
    p.id,
    t,
    {
      consentType: 'general_treatment',
      consentVersion: 'v1',
      consentText:
        'I consent to examination and treatment by the clinic doctors. The procedure, risks and alternatives have been explained to me.',
      isAgreed: true,
      signedByName: def.guardian?.name ?? def.name,
      signedByType: def.guardian ? 'guardian' : 'patient',
      witnessedBy: desk,
    } as any,
    actor,
  );

  if (ctx.rng.chance(0.25)) {
    await svc.createInsurance(
      p.id,
      clinic.orgId,
      {
        providerName: ctx.rng.pick(['State Life Insurance', 'Jubilee Life', 'Adamjee Insurance', 'EFU Life']),
        planName: ctx.rng.pick(['Corporate Health Gold', 'Family Health Plus', 'Sehat Card']),
        policyNumber: `POL-${ctx.rng.int(100000, 999999)}`,
        policyHolderName: def.guardian?.name ?? def.name,
        coveragePercentage: ctx.rng.pick([50, 70, 80]),
        maxAnnualBenefit: ctx.rng.pick([100000, 200000, 300000]),
        validFrom: addDays(registeredOn, -100),
        validUntil: addDays(registeredOn, 265),
      } as any,
      actor,
    );
  }

  if (ctx.rng.chance(0.3)) {
    await svc.createCommunication(
      p.id,
      t,
      {
        type: 'call',
        direction: 'inbound',
        purpose: 'general',
        subject: 'Enquiry about treatment charges',
        messageBody: 'Patient called to ask about consultation fee and timings.',
        status: 'received',
        sentBy: desk,
      } as any,
      actor,
    );
  }

  if (ctx.rng.chance(0.2)) {
    await svc.createReferral(
      p.id,
      clinic.orgId,
      {
        referredName: ctx.rng.pick(['Kashif Mehmood', 'سعدیہ بیگم', 'Junaid Akhtar', 'Asma Rani']),
        referredPhone: `0333${String(ctx.rng.int(1000000, 9999999))}`,
        notes: 'Referred a relative',
      } as any,
      actor,
    );
  }

  // A recall for later (dental: 6-month check-up; general: follow-up).
  if (ctx.rng.chance(0.5)) {
    await svc.createRecall(
      p.id,
      t,
      clinic.kind === 'dental'
        ? {
            recallType: '6_month_checkup',
            dueDate: addDays(registeredOn, 180),
            dentistId: docUser,
            notes: 'Routine check-up and scaling',
          }
        : {
            recallType: 'custom',
            customName: 'BP / sugar follow-up',
            dueDate: addDays(registeredOn, 30),
            dentistId: docUser,
          } as any,
      actor,
    );
  }
}

function cnicFor(def: PatientDef): string {
  const prefix = def.city === 'Karachi' ? '42101' : def.city === 'Lahore' ? '35202' : '61101';
  const digits = def.phone.slice(-7);
  return `${prefix}-${digits}-${def.gender === 'male' ? 1 : 2}`;
}

function emailFor(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@mail.seed.test`;
}
