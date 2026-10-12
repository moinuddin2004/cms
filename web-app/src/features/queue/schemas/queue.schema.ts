import { z } from 'zod'

const phoneRe = /^[0-9+\-\s()]{7,20}$/

/**
 * Walk-in registration. A doctor is required (tokens belong to a doctor).
 * Either pick an existing patient (`mode: 'search'`) or create one from
 * name + phone (`mode: 'new'`). Urgent priority needs a reason.
 */
export const walkInSchema = z
  .object({
    mode: z.enum(['search', 'new']),
    patientId: z.string(),
    patientName: z.string().trim().max(150, 'At most 150 characters'),
    patientPhone: z.string().trim().max(20, 'At most 20 characters'),
    doctorId: z
      .string()
      .min(1, 'Choose the doctor — tokens belong to a doctor'),
    reasonForVisit: z.string().trim().max(500, 'At most 500 characters'),
    urgent: z.boolean(),
    urgentReason: z.string().trim().max(500, 'At most 500 characters'),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'search' && !v.patientId) {
      ctx.addIssue({
        code: 'custom',
        path: ['patientId'],
        message: 'Pick a patient or switch to "New patient"',
      })
    }
    if (v.mode === 'new') {
      if (!v.patientName) {
        ctx.addIssue({
          code: 'custom',
          path: ['patientName'],
          message: 'Name is required',
        })
      }
      if (!phoneRe.test(v.patientPhone)) {
        ctx.addIssue({
          code: 'custom',
          path: ['patientPhone'],
          message: 'Enter a valid phone number',
        })
      }
    }
    if (v.urgent && !v.urgentReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['urgentReason'],
        message: 'A reason is required for urgent priority',
      })
    }
  })

export type WalkInFormValues = z.input<typeof walkInSchema>

const minutes = (min: number, max: number) =>
  z.coerce
    .number({ message: 'Enter a number' })
    .int('Whole minutes')
    .min(min, `At least ${min}`)
    .max(max, `At most ${max}`)

/** Queue settings (location override or organization default). */
export const queuePolicySchema = z
  .object({
    scope: z.enum(['location', 'organization']),
    smartQueueEnabled: z.boolean(),
    earlyWindowMin: minutes(0, 240),
    lateGraceMin: minutes(0, 240),
    maxLateMin: minutes(0, 480),
    walkinStarvationMin: minutes(1, 480),
    skippedRejoinPolicy: z.enum(['end', 'original_position', 'manual']),
    callTimeoutSec: z.union([
      z.literal(''),
      z.coerce
        .number()
        .int()
        .min(30, 'At least 30 seconds')
        .max(3600, 'At most 3600 seconds'),
    ]),
    manualSelectReasonRequired: z.boolean(),
    serviceDayCutoff: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM, e.g. 04:00'),
  })
  .refine((v) => Number(v.maxLateMin) >= Number(v.lateGraceMin), {
    message: 'Must be at least the late grace',
    path: ['maxLateMin'],
  })

export type QueuePolicyFormValues = z.input<typeof queuePolicySchema>
