/**
 * What happens in a visit: complaint → findings → diagnosis → treatments done
 * today (service codes from data/services.ts) → optional treatment plan →
 * prescription. The visits step picks a scenario per visit.
 */

export interface Med {
  name: string;
  urdu?: string;
  type: 'TABLET' | 'CAPSULE' | 'SYRUP' | 'INJECTION' | 'GEL' | 'SACHET' | 'DROPS' | 'INHALER' | 'OTHER';
  dosage: string;
  frequency: string;
  timing?: string[];
  meal?: 'BEFORE_MEAL' | 'AFTER_MEAL' | 'WITH_MEAL' | 'EMPTY_STOMACH' | 'NONE';
  duration: string;
  note?: string;
  noteUrdu?: string;
}

export interface PlanLine {
  code: string;
  sessions: number;
  tooth?: string;
}

export interface Scenario {
  key: string;
  complaint: string;
  examination: string;
  diagnosis: string;
  advice: string;
  /** Services done today (charged at completion). */
  today: string[];
  /** Treatment plan proposed today; later visits do its sessions. */
  plan?: { name: string; lines: PlanLine[] };
  meds?: Med[];
  instructionsUrdu?: string;
  /** Chart marks made today (FDI tooth → entry), dental only. */
  chart?: Record<string, any>;
  /** Only for these doctors' specialties (else anyone). */
  specialties?: string[];
  /** Patient filter. */
  who?: 'child' | 'adult' | 'female-adult' | 'any';
  /** Booked appointment type. */
  type?: 'consultation' | 'follow_up' | 'treatment' | 'checkup' | 'emergency' | 'cleaning';
  weight?: number;
}

const PARACETAMOL: Med = { name: 'Panadol 500mg', urdu: 'پیناڈول', type: 'TABLET', dosage: '2 tablets', frequency: '3 times a day', timing: ['morning', 'afternoon', 'night'], meal: 'AFTER_MEAL', duration: '3 Days', noteUrdu: 'بخار یا درد ہو تو' };
const BRUFEN: Med = { name: 'Brufen 400mg', urdu: 'بروفین', type: 'TABLET', dosage: '1 tablet', frequency: '3 times a day', timing: ['morning', 'afternoon', 'night'], meal: 'AFTER_MEAL', duration: '3 Days', note: 'Take after food', noteUrdu: 'کھانے کے بعد لیں' };
const AUGMENTIN: Med = { name: 'Augmentin 625mg', urdu: 'آگمینٹن', type: 'TABLET', dosage: '1 tablet', frequency: 'Twice a day', timing: ['morning', 'night'], meal: 'AFTER_MEAL', duration: '5 Days', noteUrdu: 'کورس پورا کریں' };
const FLAGYL: Med = { name: 'Flagyl 400mg', urdu: 'فلیجل', type: 'TABLET', dosage: '1 tablet', frequency: '3 times a day', meal: 'AFTER_MEAL', duration: '5 Days' };
const RISEK: Med = { name: 'Risek 20mg', type: 'CAPSULE', dosage: '1 capsule', frequency: 'Once a day', timing: ['morning'], meal: 'EMPTY_STOMACH', duration: '7 Days', noteUrdu: 'ناشتے سے پہلے' };
const MOUTHWASH: Med = { name: 'Chlorhexidine Mouthwash 0.12%', urdu: 'ماؤتھ واش', type: 'OTHER', dosage: '10 ml rinse', frequency: 'Twice a day', meal: 'AFTER_MEAL', duration: '14 Days', noteUrdu: 'کلی کریں، نگلیں نہیں' };
const SENSODYNE: Med = { name: 'Sensodyne Repair & Protect toothpaste', type: 'OTHER', dosage: 'Pea-sized', frequency: 'Twice a day', duration: '1 Month' };

export const DENTAL_SCENARIOS: Scenario[] = [
  {
    key: 'pulpitis', weight: 3, type: 'consultation', who: 'adult',
    complaint: 'Severe pain in lower right back tooth for 3 days, worse at night',
    examination: 'Deep carious lesion on 46, tender on percussion, IOPA shows caries approaching pulp',
    diagnosis: 'Irreversible pulpitis — 46',
    advice: 'Root canal treatment advised followed by crown. Avoid chewing on the right side.',
    today: ['XRAY-IOPA'],
    plan: { name: 'Root canal + crown (46)', lines: [{ code: 'RCT-MOL', sessions: 3, tooth: '46' }, { code: 'CROWN-PFM', sessions: 2, tooth: '46' }] },
    meds: [AUGMENTIN, BRUFEN, RISEK],
    instructionsUrdu: 'دوائی کھانے کے بعد لیں۔ گرم اور ٹھنڈی چیزوں سے پرہیز کریں۔',
    chart: { '46': { rootCanal: { planned: true }, condition: 'CROWN', planned: true, surfaces: { O: { condition: 'CARIES' } } } },
  },
  {
    key: 'gingivitis', weight: 3, type: 'cleaning', who: 'adult',
    complaint: 'Bleeding gums while brushing, bad breath',
    examination: 'Generalised supra-gingival calculus, gums inflamed and bleeding on probing',
    diagnosis: 'Chronic generalised gingivitis',
    advice: 'Brush twice daily with soft brush, use floss. Scaling every 6 months.',
    today: ['SCALE'],
    meds: [MOUTHWASH],
    instructionsUrdu: 'دن میں دو بار برش کریں اور ماؤتھ واش استعمال کریں۔',
  },
  {
    key: 'caries', weight: 4, type: 'treatment', who: 'any',
    complaint: 'Food getting stuck in a tooth, sensitivity to sweets',
    examination: 'Occlusal caries on 36, no periapical involvement',
    diagnosis: 'Dental caries (occlusal) — 36',
    advice: 'Filling done. Avoid hard food for 24 hours.',
    today: ['FILL-COMP'],
    chart: { '36': { surfaces: { O: { condition: 'FILLED' } } } },
  },
  {
    key: 'wisdom', weight: 2, type: 'consultation', who: 'adult', specialties: ['Oral Surgeon', 'General Dentist', 'Implantologist', 'Endodontist', 'Prosthodontist'],
    complaint: 'Pain and swelling behind the last lower tooth',
    examination: 'Partially erupted 48 with pericoronitis; OPG shows mesioangular impaction',
    diagnosis: 'Impacted 48 with pericoronitis',
    advice: 'Surgical removal advised after antibiotics. Warm salt-water rinses.',
    today: ['XRAY-OPG'],
    plan: { name: 'Surgical extraction 48', lines: [{ code: 'EXT-SURG', sessions: 1, tooth: '48' }] },
    meds: [AUGMENTIN, FLAGYL, BRUFEN],
    instructionsUrdu: 'نیم گرم نمک والے پانی سے کلی کریں۔',
    chart: { '48': { condition: 'EXTRACTION_NEEDED', planned: true } },
  },
  {
    key: 'implant', weight: 1, type: 'consultation', who: 'adult', specialties: ['Implantologist', 'Prosthodontist', 'General Dentist'],
    complaint: 'Missing lower left tooth, wants fixed replacement',
    examination: '36 missing, adequate bone on OPG',
    diagnosis: 'Edentulous space — 36',
    advice: 'Implant with zirconia crown planned. Healing period 3 months before crown.',
    today: ['XRAY-OPG'],
    plan: { name: 'Implant + crown (36)', lines: [{ code: 'IMPLANT', sessions: 2, tooth: '36' }, { code: 'CROWN-ZR', sessions: 2, tooth: '36' }] },
    chart: { '36': { condition: 'MISSING' } },
  },
  {
    key: 'ortho', weight: 1, type: 'consultation', who: 'child', specialties: ['Orthodontist', 'Pediatric Dentist', 'General Dentist'],
    complaint: 'Crooked front teeth, parents concerned',
    examination: 'Crowding in upper and lower anteriors, Class II molar relation',
    diagnosis: 'Class II malocclusion with crowding',
    advice: 'Fixed braces for ~18 months, monthly adjustments.',
    today: ['XRAY-OPG'],
    plan: { name: 'Orthodontic treatment (braces)', lines: [{ code: 'ORTHO-BRACES', sessions: 1 }, { code: 'ORTHO-ADJ', sessions: 12 }] },
  },
  {
    key: 'fracture', weight: 1, type: 'emergency', who: 'any',
    complaint: 'Front tooth broke after a fall',
    examination: 'Ellis class III fracture of 11 with pulp exposure',
    diagnosis: 'Complicated crown fracture — 11',
    advice: 'Root canal and zirconia crown advised.',
    today: ['XRAY-IOPA'],
    plan: { name: 'RCT + zirconia crown (11)', lines: [{ code: 'RCT-ANT', sessions: 2, tooth: '11' }, { code: 'CROWN-ZR', sessions: 2, tooth: '11' }] },
    meds: [BRUFEN],
    chart: { '11': { rootCanal: { planned: true }, condition: 'CROWN', planned: true } },
  },
  {
    key: 'checkup', weight: 3, type: 'checkup', who: 'any',
    complaint: 'Routine dental check-up',
    examination: 'Mild calculus lower anteriors, no caries',
    diagnosis: 'Healthy dentition, mild calculus',
    advice: 'Continue oral hygiene. Recall after 6 months.',
    today: ['SCALE'],
  },
  {
    key: 'child-caries', weight: 2, type: 'treatment', who: 'child', specialties: ['Pediatric Dentist', 'General Dentist', 'Orthodontist', 'Endodontist', 'Prosthodontist', 'Implantologist'],
    complaint: 'Child complains of tooth pain while eating',
    examination: 'Deep caries in primary molar 75, pulp involvement',
    diagnosis: 'Pulpitis in primary molar — 75',
    advice: 'Pulpotomy done. Fluoride application. Reduce sweets.',
    today: ['PULPO', 'FLUOR'],
    meds: [{ name: 'Calpol Syrup 120mg/5ml', urdu: 'کیلپول', type: 'SYRUP', dosage: '5 ml', frequency: '3 times a day', meal: 'AFTER_MEAL', duration: '3 Days' }],
  },
  {
    key: 'sensitivity', weight: 2, type: 'consultation', who: 'adult',
    complaint: 'Sensitivity to cold water',
    examination: 'Cervical abrasion on premolars, no caries',
    diagnosis: 'Dentine hypersensitivity',
    advice: 'Use desensitising toothpaste, avoid hard brushing.',
    today: ['FLUOR'],
    meds: [SENSODYNE],
  },
  {
    key: 'whitening', weight: 1, type: 'treatment', who: 'adult',
    complaint: 'Yellow teeth, wants whitening before a wedding',
    examination: 'Extrinsic staining, no caries',
    diagnosis: 'Extrinsic tooth discolouration',
    advice: 'Avoid tea, coffee and colas for 48 hours.',
    today: ['SCALE', 'WHITEN'],
  },
  {
    key: 'extraction', weight: 2, type: 'treatment', who: 'adult',
    complaint: 'Broken-down painful tooth, wants it removed',
    examination: 'Grossly decayed 17, non-restorable',
    diagnosis: 'Non-restorable 17',
    advice: 'Bite on gauze for 30 minutes. No spitting or hot food today.',
    today: ['EXT-SIMPLE'],
    meds: [BRUFEN, AUGMENTIN],
    instructionsUrdu: 'آج گرم کھانا اور تھوکنا منع ہے۔',
    chart: { '17': { condition: 'MISSING' } },
  },
];

export const GENERAL_SCENARIOS: Scenario[] = [
  {
    key: 'urti', weight: 4, type: 'consultation', who: 'any',
    complaint: 'Fever, sore throat and cough for 2 days',
    examination: 'Temp 38.4°C, congested throat, chest clear',
    diagnosis: 'Acute upper respiratory tract infection',
    advice: 'Plenty of fluids, steam inhalation, rest.',
    today: [],
    meds: [PARACETAMOL, { name: 'Amoxil 500mg', urdu: 'اموکسل', type: 'CAPSULE', dosage: '1 capsule', frequency: '3 times a day', meal: 'AFTER_MEAL', duration: '5 Days' }, { name: 'Hydryllin Syrup', type: 'SYRUP', dosage: '10 ml', frequency: '3 times a day', duration: '5 Days' }],
    instructionsUrdu: 'زیادہ پانی پئیں اور آرام کریں۔',
  },
  {
    key: 'htn', weight: 3, type: 'follow_up', who: 'adult',
    complaint: 'BP follow-up, occasional headache',
    examination: 'BP 150/95, pulse 82, no oedema',
    diagnosis: 'Essential hypertension (uncontrolled)',
    advice: 'Low salt diet, daily walk, check BP at home.',
    today: ['ECG'],
    meds: [{ name: 'Norvasc 5mg', urdu: 'نارواسک', type: 'TABLET', dosage: '1 tablet', frequency: 'Once a day', timing: ['morning'], meal: 'NONE', duration: '1 Month' }],
    instructionsUrdu: 'نمک کم کریں اور روزانہ چہل قدمی کریں۔',
  },
  {
    key: 'dm', weight: 3, type: 'follow_up', who: 'adult',
    complaint: 'Sugar follow-up, increased thirst',
    examination: 'Random blood sugar 245 mg/dl',
    diagnosis: 'Type 2 diabetes mellitus (poorly controlled)',
    advice: 'Avoid sweets and white rice, check fasting sugar weekly.',
    today: ['BSR'],
    meds: [{ name: 'Glucophage 500mg', urdu: 'گلوکوفیج', type: 'TABLET', dosage: '1 tablet', frequency: 'Twice a day', timing: ['morning', 'night'], meal: 'WITH_MEAL', duration: '1 Month' }],
    instructionsUrdu: 'میٹھا اور سفید چاول کم کریں۔',
  },
  {
    key: 'ge', weight: 2, type: 'emergency', who: 'any',
    complaint: 'Loose motions and vomiting since last night',
    examination: 'Mild dehydration, abdomen soft',
    diagnosis: 'Acute gastroenteritis',
    advice: 'ORS after every loose stool, light diet.',
    today: ['DRIP'],
    meds: [{ name: 'ORS sachet', urdu: 'او آر ایس', type: 'SACHET', dosage: '1 sachet in 1 litre water', frequency: 'SOS (as needed)', duration: '3 Days' }, FLAGYL, { name: 'Motilium 10mg', type: 'TABLET', dosage: '1 tablet', frequency: '3 times a day', meal: 'BEFORE_MEAL', duration: '3 Days' }],
    instructionsUrdu: 'ہر پاخانے کے بعد او آر ایس پئیں۔',
  },
  {
    key: 'anc', weight: 2, type: 'checkup', who: 'female-adult', specialties: ['Gynaecologist'],
    complaint: 'Routine antenatal visit',
    examination: 'BP 110/70, fundal height appropriate, FHR normal on ultrasound',
    diagnosis: 'Intrauterine pregnancy — normal progress',
    advice: 'Iron and calcium daily, next visit in 4 weeks.',
    today: ['US-OBS'],
    meds: [{ name: 'Folic Acid 5mg', type: 'TABLET', dosage: '1 tablet', frequency: 'Once a day', duration: '1 Month' }, { name: 'Calcium + Vit D (Qalsan-D)', type: 'TABLET', dosage: '1 tablet', frequency: 'Once a day', meal: 'AFTER_MEAL', duration: '1 Month' }],
  },
  {
    key: 'vaccine', weight: 2, type: 'checkup', who: 'child', specialties: ['Paediatrician', 'General Practitioner'],
    complaint: 'Due for vaccination',
    examination: 'Child well, weight on 50th percentile',
    diagnosis: 'Routine immunisation',
    advice: 'Paracetamol if fever after vaccine. Next dose as per card.',
    today: ['VACC'],
    meds: [{ name: 'Calpol Syrup 120mg/5ml', urdu: 'کیلپول', type: 'SYRUP', dosage: '5 ml', frequency: 'SOS (as needed)', duration: '2 Days', noteUrdu: 'بخار ہو تو' }],
  },
  {
    key: 'asthma', weight: 1, type: 'emergency', who: 'any',
    complaint: 'Shortness of breath and wheezing',
    examination: 'Bilateral wheeze, SpO2 94%',
    diagnosis: 'Acute exacerbation of asthma',
    advice: 'Avoid dust and smoke. Use inhaler as shown.',
    today: ['NEB'],
    meds: [{ name: 'Ventolin Inhaler', urdu: 'وینٹولین', type: 'INHALER', dosage: '2 puffs', frequency: 'SOS (as needed)', duration: 'Continue' }],
  },
  {
    key: 'wound', weight: 1, type: 'emergency', who: 'any',
    complaint: 'Cut on hand from kitchen knife',
    examination: '3 cm clean laceration on left palm',
    diagnosis: 'Laceration — left hand',
    advice: 'Keep dry, dressing change after 2 days, stitches out in 7 days.',
    today: ['STITCH', 'INJ'],
    meds: [{ name: 'Velosef 500mg', type: 'CAPSULE', dosage: '1 capsule', frequency: '3 times a day', meal: 'AFTER_MEAL', duration: '5 Days' }, PARACETAMOL],
  },
  {
    key: 'backpain', weight: 2, type: 'consultation', who: 'adult',
    complaint: 'Lower back pain for one week',
    examination: 'Paraspinal tenderness, SLR negative',
    diagnosis: 'Mechanical low back pain',
    advice: 'Hot compress, avoid lifting heavy weight, posture exercises.',
    today: ['INJ'],
    meds: [{ name: 'Arinac Forte', type: 'TABLET', dosage: '1 tablet', frequency: 'Twice a day', meal: 'AFTER_MEAL', duration: '5 Days' }, RISEK],
  },
  {
    key: 'certificate', weight: 1, type: 'consultation', who: 'adult',
    complaint: 'Fitness certificate for job',
    examination: 'General physical examination normal',
    diagnosis: 'Medically fit',
    advice: '—',
    today: ['CERT'],
  },
];
