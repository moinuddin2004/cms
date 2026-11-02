import { z } from 'zod'
import {
  Gender,
  BloodGroup,
  MaritalStatus,
  Language,
  CommunicationPreference,
  PatientSource,
} from '../types'
import { todayYmd } from '@/lib/datetime'

const phoneRe = /^[0-9+\-\s()]{7,20}$/
const cnicRe = /^\d{5}-\d{7}-\d$/
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const phoneOk = (v: string) => !v.trim() || phoneRe.test(v.trim())

const optionalPhone = (message: string) => z.string().refine(phoneOk, message)

const max = (n: number) => z.string().max(n, `At most ${n} characters`)

/**
 * Patient create/edit form (PatientForm). Values stay exactly as typed — the
 * form submits them as-is — so rules only check, they never transform.
 */
export const patientSchema = z
  .object({
    // Step 0 — Basic, Guardian, Emergency & Medical
    fullName: max(150).refine((v) => !!v.trim(), 'Full Name is required'),
    phone: z
      .string()
      .refine((v) => !!v.trim(), 'Phone Number is required')
      .refine(phoneOk, 'Phone Number looks invalid (7–20 digits)'),
    whatsappNumber: optionalPhone('WhatsApp Number looks invalid'),
    dob: z
      .string()
      .refine(
        (v) => !v || v <= todayYmd(),
        'Date of Birth cannot be in the future',
      ),
    gender: z.enum(Gender).optional(),
    bloodGroup: z.enum(BloodGroup).optional(),
    maritalStatus: z.enum(MaritalStatus).optional(),
    cnic: z
      .string()
      .refine(
        (v) => !v.trim() || cnicRe.test(v.trim()),
        'CNIC must look like 42101-1234567-1',
      ),
    email: z
      .string()
      .refine(
        (v) => !v.trim() || emailRe.test(v.trim()),
        'Email address is invalid',
      ),
    city: max(100),
    address: z.string(),
    isMinor: z.boolean(),
    guardianName: max(150),
    guardianPhone: z.string(),
    guardianRelation: max(50),
    medicalHistory: z.string(),
    allergies: z.string(),
    emergencyContactName: max(150),
    emergencyContactPhone: optionalPhone(
      'Emergency Contact Phone looks invalid',
    ),
    emergencyContactRelation: max(50),

    // Step 1 — Clinic Info
    preferredLanguage: z.enum(Language),
    communicationPref: z.enum(CommunicationPreference, {
      message: 'Select a communication preference',
    }),
    source: z.enum(PatientSource, { message: 'Select a source' }),
    referredByText: max(200),
    occupation: max(100),
    internalNotes: z.string(),
    tags: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    // Guardian fields only exist (and only matter) for minor patients.
    if (!v.isMinor) return
    if (!v.guardianName.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['guardianName'],
        message: 'Guardian Name is required for minor patients',
      })
    }
    if (!phoneOk(v.guardianPhone)) {
      ctx.addIssue({
        code: 'custom',
        path: ['guardianPhone'],
        message: 'Guardian Phone looks invalid',
      })
    }
  })

export type PatientFormValues = z.input<typeof patientSchema>

/** Fields shown on each PatientForm step — used to gate "Next". */
export const PATIENT_STEP_FIELDS: ReadonlyArray<
  ReadonlyArray<keyof PatientFormValues>
> = [
  [
    'fullName',
    'phone',
    'whatsappNumber',
    'dob',
    'gender',
    'bloodGroup',
    'maritalStatus',
    'cnic',
    'email',
    'city',
    'address',
    'isMinor',
    'guardianName',
    'guardianPhone',
    'guardianRelation',
    'medicalHistory',
    'allergies',
    'emergencyContactName',
    'emergencyContactPhone',
    'emergencyContactRelation',
  ],
  [
    'preferredLanguage',
    'communicationPref',
    'source',
    'referredByText',
    'occupation',
    'internalNotes',
    'tags',
  ],
]
