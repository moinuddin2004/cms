import { z } from 'zod';

import { isYmd, todayYmd } from '@/staff/lib/datetime';

/** Digits, `+`, spaces and dashes only (the backend itself accepts any string ≤ 20). */
const PHONE = /^[0-9+\-\s]+$/;
const PHONE_MESSAGE = 'Use digits, +, spaces or dashes only';

/** Real calendar date `YYYY-MM-DD`, not after the clinic's today. */
function isValidPastYmd(value: string): boolean {
  if (!isYmd(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return false;
  }
  return value <= todayYmd();
}

const emptyToUndefined = (v: string | undefined) => (v ? v : undefined);

/**
 * S-04b quick register. `isMinor` requires guardian name and phone. Output
 * field names match `CreatePatientDto`; blank optional fields become `undefined`.
 */
export const quickRegisterSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Enter the full name').max(150, 'Max 150 characters'),
    phone: z
      .string()
      .trim()
      .min(1, 'Enter a phone number')
      .max(20, 'Max 20 characters')
      .regex(PHONE, PHONE_MESSAGE),
    gender: z.enum(['male', 'female', 'other']).optional(),
    dob: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || isValidPastYmd(v), 'Enter a valid date that is not in the future')
      .transform(emptyToUndefined),
    isMinor: z.boolean(),
    guardianName: z.string().trim().max(150, 'Max 150 characters').optional().transform(emptyToUndefined),
    guardianPhone: z
      .string()
      .trim()
      .max(20, 'Max 20 characters')
      .optional()
      .refine((v) => !v || PHONE.test(v), PHONE_MESSAGE)
      .transform(emptyToUndefined),
    guardianRelation: z.string().trim().max(50, 'Max 50 characters').optional().transform(emptyToUndefined),
  })
  .superRefine((v, ctx) => {
    if (!v.isMinor) return;
    if (!v.guardianName) {
      ctx.addIssue({ code: 'custom', path: ['guardianName'], message: 'Enter the guardian name' });
    }
    if (!v.guardianPhone) {
      ctx.addIssue({ code: 'custom', path: ['guardianPhone'], message: 'Enter the guardian phone' });
    }
  });

export type QuickRegisterValues = z.input<typeof quickRegisterSchema>;
export type QuickRegisterOutput = z.output<typeof quickRegisterSchema>;
