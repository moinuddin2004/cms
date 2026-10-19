import { z } from 'zod'

const CODE = /^[A-Za-z][A-Za-z0-9_]{1,49}$/
const STEP_CODE = /^[a-z][a-z0-9_]{0,49}$/

const max = (n: number) => z.string().trim().max(n, `At most ${n} characters`)

/** Select value meaning "no organization" / "start empty". */
export const PLATFORM = 'platform'
export const NONE = 'none'

/** Create a form schema or workflow template (platform default or org fork). */
export const definitionSchema = z.object({
  specialtyId: z.string().min(1, 'Choose a specialty'),
  owner: z.string().min(1),
  entityType: z.enum(['order', 'item', 'stage']),
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .max(50, 'At most 50 characters')
    .regex(CODE, 'Letters, digits and _ only, starting with a letter'),
  name: max(150).min(1, 'Name is required'),
  description: max(1000),
  copyFromVersionId: z.string(),
})

export type DefinitionFormValues = z.input<typeof definitionSchema>

export const stageStepSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .regex(STEP_CODE, 'lowercase letters, digits and _'),
  name: max(100).min(1, 'Name is required'),
  requiresPatientVisit: z.boolean(),
  requiresDoctorApproval: z.boolean(),
  defaultLabDays: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, 'Whole days')
    .refine((v) => Number(v) <= 365, 'At most 365 days'),
})

export const stageTemplateSchema = z
  .object({
    specialtyId: z.string().min(1, 'Choose a specialty'),
    owner: z.string().min(1),
    code: z
      .string()
      .trim()
      .min(1, 'Code is required')
      .max(50, 'At most 50 characters')
      .regex(CODE, 'Letters, digits and _ only, starting with a letter'),
    name: max(150).min(1, 'Name is required'),
    isActive: z.boolean(),
    steps: z
      .array(stageStepSchema)
      .min(1, 'Add at least one step')
      .max(20, 'At most 20 steps'),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>()
    v.steps.forEach((s, i) => {
      const code = s.code.trim()
      if (code && seen.has(code)) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'code'],
          message: 'Step codes must be unique',
        })
      }
      seen.add(code)
    })
  })

export type StageTemplateFormValues = z.input<typeof stageTemplateSchema>
export type StageStepFormValues = z.input<typeof stageStepSchema>
