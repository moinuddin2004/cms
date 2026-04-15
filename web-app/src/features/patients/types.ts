import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────

export const Gender = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const BloodGroup = {
  'A+': 'A+',
  'A-': 'A-',
  'B+': 'B+',
  'B-': 'B-',
  'AB+': 'AB+',
  'AB-': 'AB-',
  'O+': 'O+',
  'O-': 'O-',
} as const;
export type BloodGroup = (typeof BloodGroup)[keyof typeof BloodGroup];

export const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
] as const;

export const BLOOD_GROUP_OPTIONS = [
  { label: 'A+', value: 'A+' },
  { label: 'A-', value: 'A-' },
  { label: 'B+', value: 'B+' },
  { label: 'B-', value: 'B-' },
  { label: 'AB+', value: 'AB+' },
  { label: 'AB-', value: 'AB-' },
  { label: 'O+', value: 'O+' },
  { label: 'O-', value: 'O-' },
] as const;

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

// ─── Zod Schemas ────────────────────────────────────────────────────

export const patientBasicSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(255),
  phone: z.string().min(1, 'Phone number is required').max(20),
  dob: z.string().optional().default(''),
  gender: z.enum(['male', 'female', 'other']).optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional().default(''),
  city: z.string().max(100).optional().default(''),
  referredBy: z.string().max(255).optional().default(''),
  occupation: z.string().max(255).optional().default(''),
});

export const patientMedicalSchema = z.object({
  medicalHistory: z.string().optional().default(''),
  allergies: z.array(z.string()).optional().default([]),
});

export const patientEmergencySchema = z.object({
  emergencyName: z.string().max(255).optional().default(''),
  emergencyPhone: z.string().max(20).optional().default(''),
  emergencyRelation: z.string().max(100).optional().default(''),
});

export const patientFormSchema = patientBasicSchema
  .merge(patientMedicalSchema)
  .merge(patientEmergencySchema);

export type PatientFormData = z.infer<typeof patientFormSchema>;

// ─── API Response Types ─────────────────────────────────────────────

export interface Patient {
  id: string;
  patientId: string;
  fullName: string;
  phone: string;
  dob: string | null;
  gender: string | null;
  bloodGroup: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  medicalHistory: string | null;
  allergies: string[];
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelation: string | null;
  referredBy: string | null;
  occupation: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  message: string;
  isSuccess: boolean;
  httpStatusCode: number;
}

export interface PatientListParams {
  page?: number;
  limit?: number;
  search?: string;
  gender?: string;
  bloodGroup?: string;
  isActive?: boolean;
  sortBy?: 'createdAt' | 'fullName' | 'patientId';
  sortOrder?: 'ASC' | 'DESC';
}

// ─── Form Step Config ───────────────────────────────────────────────

export const FORM_STEPS = [
  { id: 0, title: 'Basic Info', description: 'Personal details' },
  { id: 1, title: 'Medical Info', description: 'Health information' },
  { id: 2, title: 'Emergency Contact', description: 'Emergency details' },
] as const;
