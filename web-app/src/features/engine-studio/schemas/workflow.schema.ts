import { z } from 'zod'
import { STATE_CATEGORIES, TRANSITION_SIDES } from '../types'

/** Same as the backend checker's CODE (workflow-definition.checker.ts). */
const CODE = /^[a-z][a-z0-9_]{0,49}$/
const CODE_MSG = 'Lowercase letters, digits and _, starting with a letter'

const code = (required: string) =>
  z
    .string()
    .min(1, required)
    .max(50, 'At most 50 characters')
    .regex(CODE, CODE_MSG)

const stateSchema = z.object({
  code: code('Code is required'),
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'At most 100 characters'),
  category: z.enum(STATE_CATEGORIES),
})

const transitionSchema = z.object({
  from: z.string().min(1, 'Pick a state'),
  to: z.string().min(1, 'Pick a state'),
  action: code('Action is required'),
  allowedSides: z
    .array(z.enum(TRANSITION_SIDES))
    .min(1, 'Pick at least one side'),
  allowedRoles: z.array(z.string()).optional(),
  requiredFields: z
    .array(z.string())
    .optional()
    .refine(
      (f) => (f ?? []).every((k) => CODE.test(k)),
      `Input keys: ${CODE_MSG.toLowerCase()}`,
    ),
  requiresReason: z.boolean().optional(),
  effects: z
    .array(
      z.object({
        code: z.string(),
        params: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
})

/**
 * The row-level rules of a workflow draft — what a person can fix in one
 * cell. Whole-graph rules (one initial state, reachability, one action per
 * state) stay with the server's publish check, which reports them as issues
 * on save, so a half-built draft can still be saved.
 */
export const workflowDraftSchema = z.object({
  states: z.array(stateSchema).max(60, 'At most 60 states'),
  transitions: z.array(transitionSchema).max(300, 'At most 300 transitions'),
})

export type WorkflowDraftValues = z.input<typeof workflowDraftSchema>

/**
 * Rules across rows (duplicate codes, a transition onto itself). Kept apart
 * on a loose shape because zod skips refinements on an object whose fields
 * already failed — these must show while other cells are still wrong.
 */
export const workflowCrossRowSchema = z
  .object({
    states: z.array(z.looseObject({ code: z.string() })),
    transitions: z.array(z.looseObject({ from: z.string(), to: z.string() })),
  })
  .superRefine((d, ctx) => {
    const seen = new Set<string>()
    d.states.forEach((s, i) => {
      if (!s.code) return
      if (seen.has(s.code)) {
        ctx.addIssue({
          code: 'custom',
          path: ['states', i, 'code'],
          message: `"${s.code}" is already used`,
        })
      }
      seen.add(s.code)
    })
    d.transitions.forEach((t, i) => {
      if (t.from && t.from === t.to) {
        ctx.addIssue({
          code: 'custom',
          path: ['transitions', i, 'to'],
          message: 'Must lead to a different state',
        })
      }
    })
  })

/** Zod issues keyed by dotted path ("states.1.code") → first message. */
export function workflowDraftErrors(def: unknown): Map<string, string> {
  const errors = new Map<string, string>()
  for (const schema of [workflowDraftSchema, workflowCrossRowSchema]) {
    const res = schema.safeParse(def)
    if (res.success) continue
    for (const issue of res.error.issues) {
      const key = issue.path.join('.')
      if (!errors.has(key)) errors.set(key, issue.message)
    }
  }
  return errors
}
