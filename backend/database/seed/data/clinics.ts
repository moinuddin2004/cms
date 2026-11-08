import type { ClinicKind, RoleKey } from '../lib/context';

/**
 * The clinics the seed builds. Emails are `<local>@<clinic.domain>`, all on
 * the reserved `.test` TLD; every login's password is SEED_PASSWORD.
 */

export interface StaffDef {
  key: string;
  name: string;
  gender: 'male' | 'female';
  phone: string;
  cnic: string;
  dob: string;
  designation: string;
  /** null = no login (e.g. attendant). */
  role: RoleKey | null;
  email?: string;
  /** location keys; the first is the primary one */
  locations: string[];
  employmentType?: 'full_time' | 'part_time' | 'visiting' | 'contract';
  joiningDate: string;
  /** Monthly salary in rupees (salary plans). */
  salary?: number;
  /** Doctor on commission (percent of collected), optional base salary. */
  commissionPct?: number;
  specialty?: string;
  /** Working days (0 = Sunday) and hours at every location. */
  days?: number[];
  hours?: [string, string];
}

export interface LocationDef {
  key: string;
  name: string;
  code: string;
  tokenPrefix: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  totalChairs: number;
  isMain: boolean;
  taxRate: number;
}

export interface ClinicDef {
  key: string;
  kind: ClinicKind;
  name: string;
  domain: string;
  phone: string;
  website?: string;
  plan: 'starter' | 'professional' | 'enterprise';
  specialtyTags: string[];
  clinicType: string;
  owner: {
    name: string;
    gender: 'male' | 'female';
    phone: string;
    /** Owner also practises: gets a Doctor employment at these locations. */
    alsoDoctor?: Omit<StaffDef, 'key' | 'name' | 'gender' | 'phone' | 'role' | 'email'>;
  };
  locations: LocationDef[];
  staff: StaffDef[];
}

const MON_SAT = [1, 2, 3, 4, 5, 6];

export const CLINICS: ClinicDef[] = [
  // ── 1. Dental, Karachi, two branches ────────────────────────────────
  {
    key: 'smilecare',
    kind: 'dental',
    name: 'Smile Care Dental Clinic',
    domain: 'smilecare.seed.test',
    phone: '02135871234',
    website: 'https://smilecare.example.pk',
    plan: 'professional',
    specialtyTags: ['dental'],
    clinicType: 'dental',
    owner: {
      name: 'Dr. Kamran Siddiqui',
      gender: 'male',
      phone: '03002223344',
      alsoDoctor: {
        cnic: '42101-5512345-1',
        dob: '1978-04-12',
        designation: 'Senior Dental Surgeon',
        locations: ['clifton'],
        joiningDate: '2019-01-01',
        specialty: 'Prosthodontist',
        days: [1, 3, 5],
        hours: ['16:00', '21:00'],
      },
    },
    locations: [
      {
        key: 'clifton',
        name: 'Smile Care — Clifton',
        code: 'CLF',
        tokenPrefix: 'C',
        address: 'Plot 14-C, Block 5, Clifton',
        city: 'Karachi',
        state: 'Sindh',
        phone: '02135871234',
        totalChairs: 4,
        isMain: true,
        taxRate: 0,
      },
      {
        key: 'gulshan',
        name: 'Smile Care — Gulshan-e-Iqbal',
        code: 'GLS',
        tokenPrefix: 'G',
        address: 'Shop 3, Rashid Minhas Road, Block 10-A, Gulshan-e-Iqbal',
        city: 'Karachi',
        state: 'Sindh',
        phone: '02134981122',
        totalChairs: 3,
        isMain: false,
        taxRate: 0,
      },
    ],
    staff: [
      {
        key: 'ayesha', name: 'Dr. Ayesha Malik', gender: 'female', phone: '03211234501',
        cnic: '42201-1234501-2', dob: '1986-09-03', designation: 'Orthodontist',
        role: 'doctor', email: 'dr.ayesha', locations: ['clifton'], joiningDate: '2021-03-01',
        salary: 250000, specialty: 'Orthodontist', days: MON_SAT, hours: ['11:00', '19:00'],
      },
      {
        key: 'bilal', name: 'Dr. Bilal Ahmed', gender: 'male', phone: '03331234502',
        cnic: '42101-1234502-3', dob: '1984-01-22', designation: 'Endodontist',
        role: 'doctor', email: 'dr.bilal', locations: ['clifton', 'gulshan'], joiningDate: '2020-07-15',
        salary: 180000, commissionPct: 20, specialty: 'Endodontist', days: MON_SAT, hours: ['10:00', '18:00'],
      },
      {
        key: 'sana', name: 'Dr. Sana Tariq', gender: 'female', phone: '03451234503',
        cnic: '42301-1234503-4', dob: '1990-06-18', designation: 'General Dentist',
        role: 'doctor', email: 'dr.sana', locations: ['gulshan'], joiningDate: '2022-02-01',
        salary: 160000, specialty: 'General Dentist', days: MON_SAT, hours: ['10:00', '18:00'],
      },
      {
        key: 'usman', name: 'Dr. Usman Raza', gender: 'male', phone: '03121234504',
        cnic: '42101-1234504-5', dob: '1981-11-30', designation: 'Oral & Maxillofacial Surgeon (Visiting)',
        role: 'doctor', email: 'dr.usman', locations: ['clifton'], employmentType: 'visiting',
        joiningDate: '2023-05-10', commissionPct: 40, specialty: 'Oral Surgeon', days: [2, 4, 6], hours: ['17:00', '21:00'],
      },
      {
        key: 'hina', name: 'Hina Shah', gender: 'female', phone: '03001234505',
        cnic: '42201-1234505-6', dob: '1995-02-14', designation: 'Front Desk Officer',
        role: 'receptionist', email: 'hina', locations: ['clifton'], joiningDate: '2021-08-01', salary: 55000,
      },
      {
        key: 'mehwish', name: 'Mehwish Iqbal', gender: 'female', phone: '03011234506',
        cnic: '42201-1234506-7', dob: '1997-07-07', designation: 'Receptionist',
        role: 'receptionist', email: 'mehwish', locations: ['gulshan'], joiningDate: '2022-02-01', salary: 50000,
      },
      {
        key: 'farhan', name: 'Farhan Ali', gender: 'male', phone: '03021234507',
        cnic: '42101-1234507-8', dob: '1996-03-21', designation: 'Dental Assistant',
        role: 'assistant', email: 'farhan', locations: ['clifton'], joiningDate: '2021-09-15', salary: 45000,
      },
      {
        key: 'rabia', name: 'Rabia Noor', gender: 'female', phone: '03031234508',
        cnic: '42201-1234508-9', dob: '1998-12-01', designation: 'Dental Assistant',
        role: 'assistant', email: 'rabia', locations: ['gulshan'], joiningDate: '2022-03-01', salary: 42000,
      },
      {
        key: 'imran', name: 'Imran Qureshi', gender: 'male', phone: '03041234509',
        cnic: '42101-1234509-1', dob: '1985-05-05', designation: 'Accounts Officer',
        role: 'accountant', email: 'accounts', locations: ['clifton', 'gulshan'], joiningDate: '2020-01-01', salary: 90000,
      },
      {
        key: 'zainab', name: 'Zainab Hussain', gender: 'female', phone: '03051234510',
        cnic: '42201-1234510-2', dob: '1989-10-10', designation: 'Clinic Manager',
        role: 'admin', email: 'manager', locations: ['clifton', 'gulshan'], joiningDate: '2019-06-01', salary: 120000,
      },
      {
        key: 'aslam', name: 'Aslam Masih', gender: 'male', phone: '03061234511',
        cnic: '42101-1234511-3', dob: '1975-08-08', designation: 'Attendant',
        role: null, locations: ['clifton'], joiningDate: '2019-01-15', salary: 32000,
      },
    ],
  },

  // ── 2. Dental + implants, Lahore ────────────────────────────────────
  {
    key: 'alshifa',
    kind: 'dental',
    name: 'Al-Shifa Dental & Implant Centre',
    domain: 'alshifa.seed.test',
    phone: '04235761234',
    plan: 'starter',
    specialtyTags: ['dental'],
    clinicType: 'dental',
    owner: { name: 'Nadia Chaudhry', gender: 'female', phone: '03004445566' },
    locations: [
      {
        key: 'dha',
        name: 'Al-Shifa — DHA Phase 5',
        code: 'DHA',
        tokenPrefix: 'A',
        address: '55-CCA, Commercial Area, DHA Phase 5',
        city: 'Lahore',
        state: 'Punjab',
        phone: '04235761234',
        totalChairs: 3,
        isMain: true,
        taxRate: 5,
      },
    ],
    staff: [
      {
        key: 'hassan', name: 'Dr. Hassan Javed', gender: 'male', phone: '03224567801',
        cnic: '35202-4567801-1', dob: '1980-02-02', designation: 'Implantologist',
        role: 'doctor', email: 'dr.hassan', locations: ['dha'], joiningDate: '2018-04-01',
        salary: 300000, specialty: 'Implantologist', days: MON_SAT, hours: ['12:00', '20:00'],
      },
      {
        key: 'faisal', name: 'Dr. Faisal Butt', gender: 'male', phone: '03214567802',
        cnic: '35202-4567802-3', dob: '1987-08-15', designation: 'General Dentist',
        role: 'doctor', email: 'dr.faisal', locations: ['dha'], joiningDate: '2021-01-10',
        commissionPct: 35, salary: 60000, specialty: 'General Dentist', days: MON_SAT, hours: ['10:00', '18:00'],
      },
      {
        key: 'maryam', name: 'Dr. Maryam Akhtar', gender: 'female', phone: '03004567803',
        cnic: '35202-4567803-4', dob: '1992-04-25', designation: 'Pediatric Dentist',
        role: 'doctor', email: 'dr.maryam', locations: ['dha'], employmentType: 'part_time',
        joiningDate: '2023-09-01', salary: 110000, specialty: 'Pediatric Dentist', days: [1, 3, 5], hours: ['15:00', '20:00'],
      },
      {
        key: 'saima', name: 'Saima Riaz', gender: 'female', phone: '03014567804',
        cnic: '35202-4567804-6', dob: '1996-11-11', designation: 'Receptionist',
        role: 'receptionist', email: 'reception', locations: ['dha'], joiningDate: '2021-01-10', salary: 48000,
      },
      {
        key: 'waqas', name: 'Waqas Ahmad', gender: 'male', phone: '03024567805',
        cnic: '35202-4567805-7', dob: '1994-01-30', designation: 'Dental Assistant',
        role: 'assistant', email: 'waqas', locations: ['dha'], joiningDate: '2020-06-01', salary: 40000,
      },
      {
        key: 'tahir', name: 'Tahir Mehmood', gender: 'male', phone: '03034567806',
        cnic: '35202-4567806-8', dob: '1983-07-19', designation: 'Accountant',
        role: 'accountant', email: 'accounts', locations: ['dha'], joiningDate: '2019-03-01', salary: 85000,
      },
      {
        key: 'sobia', name: 'Sobia Khan', gender: 'female', phone: '03044567807',
        cnic: '35202-4567807-9', dob: '1988-12-12', designation: 'Practice Manager',
        role: 'admin', email: 'manager', locations: ['dha'], joiningDate: '2018-04-01', salary: 110000,
      },
    ],
  },

  // ── 3. General / family medicine, Islamabad ─────────────────────────
  {
    key: 'familycare',
    kind: 'general',
    name: 'Shifa Family Clinic',
    domain: 'familycare.seed.test',
    phone: '0512261234',
    plan: 'starter',
    specialtyTags: ['general'],
    clinicType: 'general',
    owner: {
      name: 'Dr. Asif Mehmood',
      gender: 'male',
      phone: '03005556677',
      alsoDoctor: {
        cnic: '61101-7788990-1',
        dob: '1975-03-03',
        designation: 'Family Physician',
        locations: ['f8'],
        joiningDate: '2015-01-01',
        specialty: 'General Practitioner',
        days: MON_SAT,
        hours: ['09:00', '14:00'],
      },
    },
    locations: [
      {
        key: 'f8',
        name: 'Shifa Family Clinic — F-8 Markaz',
        code: 'F8',
        tokenPrefix: 'F',
        address: 'Office 7, Kohistan Road, F-8 Markaz',
        city: 'Islamabad',
        state: 'Islamabad Capital Territory',
        phone: '0512261234',
        totalChairs: 3,
        isMain: true,
        taxRate: 0,
      },
    ],
    staff: [
      {
        key: 'fatima', name: 'Dr. Fatima Zahra', gender: 'female', phone: '03317788901',
        cnic: '61101-7788901-2', dob: '1985-05-20', designation: 'Gynaecologist',
        role: 'doctor', email: 'dr.fatima', locations: ['f8'], joiningDate: '2019-02-01',
        salary: 220000, specialty: 'Gynaecologist', days: [1, 2, 3, 4, 5], hours: ['10:00', '16:00'],
      },
      {
        key: 'omer', name: 'Dr. Omer Farooq', gender: 'male', phone: '03327788902',
        cnic: '61101-7788902-3', dob: '1988-09-09', designation: 'Paediatrician',
        role: 'doctor', email: 'dr.omer', locations: ['f8'], joiningDate: '2020-10-01',
        commissionPct: 50, specialty: 'Paediatrician', employmentType: 'visiting', days: MON_SAT, hours: ['16:00', '21:00'],
      },
      {
        key: 'nida', name: 'Nida Pervaiz', gender: 'female', phone: '03337788903',
        cnic: '61101-7788903-4', dob: '1997-03-15', designation: 'Receptionist',
        role: 'receptionist', email: 'reception', locations: ['f8'], joiningDate: '2021-05-01', salary: 45000,
      },
      {
        key: 'shazia', name: 'Shazia Bibi', gender: 'female', phone: '03347788904',
        cnic: '61101-7788904-5', dob: '1990-07-27', designation: 'Staff Nurse',
        role: 'assistant', email: 'nurse', locations: ['f8'], joiningDate: '2019-02-01', salary: 50000,
      },
      {
        key: 'adnan', name: 'Adnan Sheikh', gender: 'male', phone: '03357788905',
        cnic: '61101-7788905-6', dob: '1986-06-06', designation: 'Accountant',
        role: 'accountant', email: 'accounts', locations: ['f8'], joiningDate: '2018-01-01', salary: 75000,
      },
    ],
  },
];

/** A clinic that signed up and waits for super admin approval (owner only). */
export const PENDING_CLINIC = {
  name: 'Noor Dental Studio',
  ownerName: 'Dr. Saad Anwar',
  email: 'owner@noordental.seed.test',
  phone: '03009998877',
};
