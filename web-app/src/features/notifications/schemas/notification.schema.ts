import { z } from 'zod'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const quietHoursSchema = z
  .object({
    enabled: z.boolean(),
    start: z.string(),
    end: z.string(),
    timezone: z.string().max(64),
  })
  .superRefine((v, ctx) => {
    if (!v.enabled) return
    if (!TIME.test(v.start)) {
      ctx.addIssue({ code: 'custom', path: ['start'], message: 'Use HH:MM' })
    }
    if (!TIME.test(v.end)) {
      ctx.addIssue({ code: 'custom', path: ['end'], message: 'Use HH:MM' })
    }
    if (TIME.test(v.start) && v.start === v.end) {
      ctx.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'End must differ from start',
      })
    }
  })

export type QuietHoursFormValues = z.infer<typeof quietHoursSchema>

const PLACEHOLDER = /\{([a-z_][a-z0-9_]*)\}/gi

/** Placeholder names in `text`. */
export function placeholdersOf(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1])
}

/** Template wording; placeholders must be ones the event supplies. */
export function templateSchema(allowed: string[]) {
  const known = new Set(allowed)
  const onlyKnown = (text: string) =>
    placeholdersOf(text).every((p) => known.has(p))
  const message = `Use only: ${allowed.map((a) => `{${a}}`).join(', ')}`
  return z.object({
    subject: z
      .string()
      .max(200, 'At most 200 characters')
      .refine(onlyKnown, message),
    body: z
      .string()
      .trim()
      .min(1, 'Write the message')
      .max(1000, 'At most 1000 characters')
      .refine(onlyKnown, message),
    providerTemplateRef: z.string().max(200, 'At most 200 characters'),
  })
}

export type TemplateFormValues = z.infer<ReturnType<typeof templateSchema>>
