import { z } from 'zod';

import { isValidPhone } from '@/staff/features/patients';

/**
 * S-02c walk-in. Either an existing patient (`mode: 'existing'` + `patientId`)
 * or a new one (name + phone). Urgent needs a reason. The API body comes from
 * `toWalkInInput` (no `force`: only the confirm dialog sets it).
 */
export const walkInSchema = z
  .object({
    doctorId: z.string().min(1, 'Choose a doctor'),
    mode: z.enum(['existing', 'new']),
    patientId: z.string(),
    patientLabel: z.string(),
    fullName: z.string().trim().max(150, 'Max 150 characters'),
    phone: z.string().trim().max(20, 'Max 20 characters'),
    reasonForVisit: z.string().trim().max(500, 'Max 500 characters'),
    urgent: z.boolean(),
    urgentReason: z.string().trim().max(500, 'Max 500 characters'),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'existing') {
      if (!v.patientId) ctx.addIssue({ code: 'custom', path: ['patientId'], message: 'Choose a patient' });
    } else {
      if (!v.fullName) ctx.addIssue({ code: 'custom', path: ['fullName'], message: 'Enter the full name' });
      if (!v.phone) {
        ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a phone number' });
      } else if (!isValidPhone(v.phone)) {
        ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a valid phone number (7+ digits)' });
      }
    }
    if (v.urgent && !v.urgentReason) {
      ctx.addIssue({ code: 'custom', path: ['urgentReason'], message: 'Enter the urgent reason' });
    }
  });

export type WalkInValues = z.input<typeof walkInSchema>;

export const walkInDefaults = (
  doctorId: string,
  mode: WalkInValues['mode'] = 'existing',
): WalkInValues => ({
  doctorId,
  mode,
  patientId: '',
  patientLabel: '',
  fullName: '',
  phone: '',
  reasonForVisit: '',
  urgent: false,
  urgentReason: '',
});
