/**
 * Patients per clinic. Names are Pakistani, some written in English and some
 * in Urdu (so search, PDFs and lists get tested with both scripts).
 */

export interface PatientDef {
  name: string;
  gender: 'male' | 'female';
  dob: string;
  phone: string;
  city: string;
  area: string;
  occupation?: string;
  blood?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  marital?: 'single' | 'married' | 'divorced' | 'widowed';
  allergies?: string;
  history?: string;
  lang?: 'urdu' | 'english';
  source?: 'walk_in' | 'referral' | 'online' | 'social_media' | 'google' | 'other';
  /** location key; default: clinic's first location */
  loc?: string;
  /** Minor: guardian details are filled from the first adult listed as guardian. */
  guardian?: { name: string; phone: string; relation: string };
  tags?: string[];
}

export const PATIENTS: Record<string, PatientDef[]> = {
  smilecare: [
    { name: 'Muhammad Ali Khan', gender: 'male', dob: '1985-03-14', phone: '03001110001', city: 'Karachi', area: 'DHA Phase 6', occupation: 'Banker', blood: 'B+', marital: 'married', lang: 'english', source: 'google', tags: ['vip'] },
    { name: 'فاطمہ بی بی', gender: 'female', dob: '1962-07-01', phone: '03001110002', city: 'Karachi', area: 'Clifton Block 2', occupation: 'Housewife', blood: 'O+', marital: 'widowed', history: 'Diabetes type 2, hypertension', allergies: 'Penicillin', source: 'referral' },
    { name: 'Ahmed Raza', gender: 'male', dob: '1992-11-20', phone: '03001110003', city: 'Karachi', area: 'Bath Island', occupation: 'Software Engineer', blood: 'A+', marital: 'single', lang: 'english', source: 'social_media' },
    { name: 'عائشہ صدیقی', gender: 'female', dob: '1998-05-09', phone: '03001110004', city: 'Karachi', area: 'Clifton Block 9', occupation: 'Student', blood: 'B-', marital: 'single', source: 'walk_in' },
    { name: 'Hamza Sheikh', gender: 'male', dob: '2014-02-17', phone: '03001110005', city: 'Karachi', area: 'DHA Phase 5', blood: 'O+', guardian: { name: 'Sheikh Naveed', phone: '03001110055', relation: 'Father' }, source: 'referral' },
    { name: 'زینب حسین', gender: 'female', dob: '1979-09-23', phone: '03001110006', city: 'Karachi', area: 'Boat Basin', occupation: 'Teacher', blood: 'AB+', marital: 'married', history: 'Asthma', source: 'walk_in' },
    { name: 'Usman Ghani', gender: 'male', dob: '1970-12-05', phone: '03001110007', city: 'Karachi', area: 'Kehkashan', occupation: 'Businessman', blood: 'O-', marital: 'married', history: 'On blood thinners (warfarin)', source: 'google', tags: ['vip'] },
    { name: 'Sadia Parveen', gender: 'female', dob: '1988-04-30', phone: '03001110008', city: 'Karachi', area: 'Clifton Block 4', occupation: 'Doctor', blood: 'A-', marital: 'married', lang: 'english', source: 'online' },
    { name: 'عمران اکبر', gender: 'male', dob: '1983-08-11', phone: '03001110009', city: 'Karachi', area: 'Gizri', occupation: 'Shopkeeper', blood: 'B+', marital: 'married', source: 'walk_in' },
    { name: 'Mariam Jawed', gender: 'female', dob: '2001-01-19', phone: '03001110010', city: 'Karachi', area: 'Gulshan Block 13', occupation: 'Student', blood: 'O+', marital: 'single', loc: 'gulshan', source: 'social_media' },
    { name: 'محمد عثمان', gender: 'male', dob: '1975-06-06', phone: '03001110011', city: 'Karachi', area: 'Gulshan Block 6', occupation: 'Govt. Officer', blood: 'A+', marital: 'married', history: 'Hypertension', loc: 'gulshan', source: 'walk_in' },
    { name: 'Rimsha Khalid', gender: 'female', dob: '1995-10-02', phone: '03001110012', city: 'Karachi', area: 'Johar Block 15', occupation: 'Designer', blood: 'B+', marital: 'married', loc: 'gulshan', lang: 'english', source: 'google' },
    { name: 'سلمان احمد', gender: 'male', dob: '1990-03-27', phone: '03001110013', city: 'Karachi', area: 'Gulshan Block 2', occupation: 'Accountant', blood: 'O+', marital: 'single', loc: 'gulshan', allergies: 'Ibuprofen', source: 'referral' },
    { name: 'Noor ul Ain', gender: 'female', dob: '2016-08-14', phone: '03001110014', city: 'Karachi', area: 'Gulshan Block 10', blood: 'A+', loc: 'gulshan', guardian: { name: 'Khurram Shahzad', phone: '03001110044', relation: 'Father' }, source: 'walk_in' },
    { name: 'Tariq Jameel', gender: 'male', dob: '1958-01-01', phone: '03001110015', city: 'Karachi', area: 'Gulistan-e-Jauhar', occupation: 'Retired', blood: 'AB-', marital: 'married', history: 'Heart patient, stent 2019', loc: 'gulshan', source: 'walk_in' },
    { name: 'حنا یوسف', gender: 'female', dob: '1993-12-12', phone: '03001110016', city: 'Karachi', area: 'Clifton Block 8', occupation: 'Nurse', blood: 'B+', marital: 'married', source: 'walk_in' },
  ],
  alshifa: [
    { name: 'Ali Hamza', gender: 'male', dob: '1987-05-15', phone: '03002220001', city: 'Lahore', area: 'DHA Phase 4', occupation: 'Engineer', blood: 'B+', marital: 'married', lang: 'english', source: 'google' },
    { name: 'صائمہ ناز', gender: 'female', dob: '1972-02-28', phone: '03002220002', city: 'Lahore', area: 'Cantt', occupation: 'Housewife', blood: 'O+', marital: 'married', history: 'Diabetes type 2', source: 'referral' },
    { name: 'Zeeshan Haider', gender: 'male', dob: '1966-09-09', phone: '03002220003', city: 'Lahore', area: 'Gulberg III', occupation: 'Businessman', blood: 'A+', marital: 'married', history: 'Missing teeth — implant candidate', source: 'google', tags: ['implant'] },
    { name: 'مریم نواز خان', gender: 'female', dob: '1999-11-03', phone: '03002220004', city: 'Lahore', area: 'Model Town', occupation: 'Student', blood: 'B-', marital: 'single', source: 'social_media' },
    { name: 'Abdullah Tariq', gender: 'male', dob: '2017-04-04', phone: '03002220005', city: 'Lahore', area: 'DHA Phase 5', blood: 'O+', guardian: { name: 'Tariq Mehmood', phone: '03002220055', relation: 'Father' }, source: 'referral' },
    { name: 'Hira Mansoor', gender: 'female', dob: '1991-07-21', phone: '03002220006', city: 'Lahore', area: 'Johar Town', occupation: 'Banker', blood: 'AB+', marital: 'married', lang: 'english', source: 'online' },
    { name: 'چوہدری اکرم', gender: 'male', dob: '1955-03-17', phone: '03002220007', city: 'Lahore', area: 'Bedian Road', occupation: 'Landlord', blood: 'O-', marital: 'married', history: 'Complete denture wearer', source: 'walk_in', tags: ['vip'] },
    { name: 'Bushra Anjum', gender: 'female', dob: '1984-10-30', phone: '03002220008', city: 'Lahore', area: 'Askari 10', occupation: 'Teacher', blood: 'A-', marital: 'married', allergies: 'Latex', source: 'walk_in' },
    { name: 'شہزاد اقبال', gender: 'male', dob: '1980-01-25', phone: '03002220009', city: 'Lahore', area: 'Walton', occupation: 'Army Officer', blood: 'B+', marital: 'married', source: 'referral' },
    { name: 'Laiba Shahid', gender: 'female', dob: '2010-06-01', phone: '03002220010', city: 'Lahore', area: 'DHA Phase 3', blood: 'A+', guardian: { name: 'Shahid Latif', phone: '03002220066', relation: 'Father' }, source: 'walk_in', tags: ['ortho'] },
    { name: 'Kashif Nadeem', gender: 'male', dob: '1994-08-08', phone: '03002220011', city: 'Lahore', area: 'Township', occupation: 'Driver', blood: 'O+', marital: 'single', source: 'walk_in' },
  ],
  familycare: [
    { name: 'Raheel Abbasi', gender: 'male', dob: '1982-04-04', phone: '03003330001', city: 'Islamabad', area: 'F-7/2', occupation: 'Civil Servant', blood: 'B+', marital: 'married', history: 'Hypertension', lang: 'english', source: 'walk_in' },
    { name: 'نسرین اختر', gender: 'female', dob: '1968-12-19', phone: '03003330002', city: 'Islamabad', area: 'G-9/4', occupation: 'Housewife', blood: 'O+', marital: 'married', history: 'Diabetes type 2, thyroid', source: 'referral' },
    { name: 'Ayan Malik', gender: 'male', dob: '2021-09-10', phone: '03003330003', city: 'Islamabad', area: 'F-10/3', blood: 'A+', guardian: { name: 'Sara Malik', phone: '03003330033', relation: 'Mother' }, source: 'referral' },
    { name: 'Sana Gul', gender: 'female', dob: '1996-02-14', phone: '03003330004', city: 'Rawalpindi', area: 'Bahria Town Phase 7', occupation: 'Lecturer', blood: 'B+', marital: 'married', history: 'Pregnant — 2nd trimester', source: 'google' },
    { name: 'محمد بلال', gender: 'male', dob: '1990-05-30', phone: '03003330005', city: 'Islamabad', area: 'I-8/2', occupation: 'Mechanic', blood: 'O-', marital: 'single', allergies: 'Sulfa drugs', source: 'walk_in' },
    { name: 'Khadija Rauf', gender: 'female', dob: '1953-07-07', phone: '03003330006', city: 'Islamabad', area: 'F-8/1', occupation: 'Retired', blood: 'AB+', marital: 'widowed', history: 'Osteoarthritis, hypertension', source: 'walk_in', tags: ['senior'] },
    { name: 'Hassan Ali Shah', gender: 'male', dob: '2018-11-25', phone: '03003330007', city: 'Islamabad', area: 'G-11/3', blood: 'B+', guardian: { name: 'Ali Shah', phone: '03003330077', relation: 'Father' }, source: 'walk_in' },
    { name: 'ثمینہ کوثر', gender: 'female', dob: '1987-03-03', phone: '03003330008', city: 'Islamabad', area: 'E-11/4', occupation: 'Pharmacist', blood: 'A+', marital: 'married', source: 'online' },
    { name: 'Faraz Qureshi', gender: 'male', dob: '1978-10-10', phone: '03003330009', city: 'Islamabad', area: 'F-6/3', occupation: 'Journalist', blood: 'O+', marital: 'married', history: 'Asthma', lang: 'english', source: 'social_media' },
    { name: 'گل بانو', gender: 'female', dob: '1975-01-15', phone: '03003330010', city: 'Islamabad', area: 'Bari Imam', occupation: 'Domestic worker', blood: 'B-', marital: 'married', source: 'walk_in' },
    { name: 'Daniyal Ahmed', gender: 'male', dob: '2003-06-21', phone: '03003330011', city: 'Islamabad', area: 'H-13', occupation: 'Student', blood: 'A-', marital: 'single', source: 'social_media' },
  ],
};
