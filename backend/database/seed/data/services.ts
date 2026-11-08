/**
 * Service catalog (billing `services`) per clinic kind. Prices in rupees.
 * `CONS` is every clinic's default consultation (location billing settings),
 * so each completed visit gets a consultation charge. PROCEDURE services are
 * what doctors pick as treatments in a visit (TreatmentsService).
 *
 * The billing step inserts these and fills `SeedClinic.services` (code → id);
 * the visits step picks treatments by `code`.
 */
export interface ServiceDef {
  code: string;
  name: string;
  kind: 'CONSULTATION' | 'PROCEDURE' | 'OTHER';
  price: number;
  category: string;
}

export const DENTAL_SERVICES: ServiceDef[] = [
  { code: 'CONS', name: 'Dental Consultation', kind: 'CONSULTATION', price: 1500, category: 'Consultation' },
  { code: 'CONS-FU', name: 'Follow-up Visit', kind: 'CONSULTATION', price: 800, category: 'Consultation' },
  { code: 'XRAY-IOPA', name: 'X-Ray (IOPA)', kind: 'PROCEDURE', price: 800, category: 'Diagnostics' },
  { code: 'XRAY-OPG', name: 'OPG (Full Mouth X-Ray)', kind: 'PROCEDURE', price: 2500, category: 'Diagnostics' },
  { code: 'SCALE', name: 'Scaling & Polishing', kind: 'PROCEDURE', price: 4000, category: 'Preventive' },
  { code: 'FLUOR', name: 'Fluoride Application', kind: 'PROCEDURE', price: 2000, category: 'Preventive' },
  { code: 'FILL-COMP', name: 'Composite Filling', kind: 'PROCEDURE', price: 5000, category: 'Restorative' },
  { code: 'FILL-GIC', name: 'GIC Filling', kind: 'PROCEDURE', price: 3000, category: 'Restorative' },
  { code: 'RCT-ANT', name: 'Root Canal — Anterior', kind: 'PROCEDURE', price: 12000, category: 'Endodontics' },
  { code: 'RCT-MOL', name: 'Root Canal — Molar', kind: 'PROCEDURE', price: 18000, category: 'Endodontics' },
  { code: 'EXT-SIMPLE', name: 'Simple Extraction', kind: 'PROCEDURE', price: 3000, category: 'Oral Surgery' },
  { code: 'EXT-SURG', name: 'Surgical Extraction (Wisdom Tooth)', kind: 'PROCEDURE', price: 15000, category: 'Oral Surgery' },
  { code: 'CROWN-PFM', name: 'PFM Crown', kind: 'PROCEDURE', price: 15000, category: 'Prosthodontics' },
  { code: 'CROWN-ZR', name: 'Zirconia Crown', kind: 'PROCEDURE', price: 35000, category: 'Prosthodontics' },
  { code: 'DENTURE-CD', name: 'Complete Denture (per arch)', kind: 'PROCEDURE', price: 30000, category: 'Prosthodontics' },
  { code: 'BRIDGE-PFM', name: 'PFM Bridge (3 units)', kind: 'PROCEDURE', price: 42000, category: 'Prosthodontics' },
  { code: 'IMPLANT-CROWN', name: 'Implant Crown', kind: 'PROCEDURE', price: 40000, category: 'Implants' },
  { code: 'DENTURE-REPAIR', name: 'Denture Repair', kind: 'PROCEDURE', price: 5000, category: 'Prosthodontics' },
  { code: 'IMPLANT', name: 'Dental Implant (fixture)', kind: 'PROCEDURE', price: 120000, category: 'Implants' },
  { code: 'WHITEN', name: 'Teeth Whitening (in-office)', kind: 'PROCEDURE', price: 25000, category: 'Cosmetic' },
  { code: 'ORTHO-BRACES', name: 'Orthodontic Braces (metal) — start', kind: 'PROCEDURE', price: 80000, category: 'Orthodontics' },
  { code: 'ORTHO-ADJ', name: 'Braces Adjustment', kind: 'PROCEDURE', price: 3000, category: 'Orthodontics' },
  { code: 'PULPO', name: 'Pulpotomy (child)', kind: 'PROCEDURE', price: 6000, category: 'Paediatric' },
  { code: 'MOUTHGUARD', name: 'Night Guard', kind: 'OTHER', price: 8000, category: 'Appliances' },
];

export const GENERAL_SERVICES: ServiceDef[] = [
  { code: 'CONS', name: 'General Consultation', kind: 'CONSULTATION', price: 2000, category: 'Consultation' },
  { code: 'CONS-SPEC', name: 'Specialist Consultation', kind: 'CONSULTATION', price: 3000, category: 'Consultation' },
  { code: 'CONS-FU', name: 'Follow-up Visit', kind: 'CONSULTATION', price: 1000, category: 'Consultation' },
  { code: 'BSR', name: 'Blood Sugar (Random)', kind: 'PROCEDURE', price: 300, category: 'Tests' },
  { code: 'ECG', name: 'ECG', kind: 'PROCEDURE', price: 1500, category: 'Tests' },
  { code: 'NEB', name: 'Nebulization', kind: 'PROCEDURE', price: 800, category: 'Procedures' },
  { code: 'INJ', name: 'Injection (IM/IV) administration', kind: 'PROCEDURE', price: 500, category: 'Procedures' },
  { code: 'DRIP', name: 'IV Drip', kind: 'PROCEDURE', price: 2500, category: 'Procedures' },
  { code: 'DRESS', name: 'Wound Dressing', kind: 'PROCEDURE', price: 1000, category: 'Procedures' },
  { code: 'STITCH', name: 'Suturing (minor)', kind: 'PROCEDURE', price: 3500, category: 'Procedures' },
  { code: 'US-OBS', name: 'Obstetric Ultrasound', kind: 'PROCEDURE', price: 3500, category: 'Imaging' },
  { code: 'VACC', name: 'Vaccination (EPI / private)', kind: 'PROCEDURE', price: 2500, category: 'Paediatrics' },
  { code: 'CERT', name: 'Medical Certificate', kind: 'OTHER', price: 1000, category: 'Documents' },
];

export function servicesFor(kind: 'dental' | 'general'): ServiceDef[] {
  return kind === 'dental' ? DENTAL_SERVICES : GENERAL_SERVICES;
}
