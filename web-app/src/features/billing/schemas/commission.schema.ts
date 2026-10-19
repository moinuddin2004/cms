import { z } from 'zod'
import { percentToBps, rupeesToPaisa } from '../lib/commission-math'
import type {
  CommissionRuleInput,
  CompensationPlanInput,
} from '../types/commission.types'
import type { ServiceKind } from '../types/billing.types'

// Inputs are edited as text and converted with integer math only
// (% → basis points, rupees → paisa) in `toPlanInput` / `toRuleInputs`.

export const ruleRowSchema = z.object({
  /** `svc:<serviceId>` or `cat:<ServiceKind>`. */
  target: z.string().min(1, 'Choose a service or category'),
  mode: z.enum(['percent', 'fixed']),
  value: z.string().trim(),
})
export type RuleRow = z.infer<typeof ruleRowSchema>

/** Per-row messages, shared by the zod refinement and the rules editor. */
export function ruleRowErrors(
  rules: RuleRow[],
): Array<{ target?: string; value?: string }> {
  const seen = new Set<string>()
  return rules.map((r) => {
    const out: { target?: string; value?: string } = {}
    if (!r.target) out.target = 'Choose a service or category'
    else if (seen.has(r.target))
      out.target = 'Only one override per service or category'
    seen.add(r.target)
    const ok =
      r.mode === 'percent'
        ? percentToBps(r.value) !== null
        : rupeesToPaisa(r.value) !== null
    if (!ok)
      out.value =
        r.mode === 'percent'
          ? 'Enter 0–100 (max 2 decimals)'
          : 'Enter an amount (max 2 decimals)'
    return out
  })
}

function checkRules(rules: RuleRow[], ctx: z.RefinementCtx) {
  ruleRowErrors(rules).forEach((e, i) => {
    for (const key of ['target', 'value'] as const) {
      if (e[key])
        ctx.addIssue({
          code: 'custom',
          path: ['rules', i, key],
          message: e[key],
        })
    }
  })
}

export const compensationSchema = z
  .object({
    type: z.enum(['SALARY', 'COMMISSION', 'SALARY_PLUS_COMMISSION']),
    salary: z.string().trim(),
    rate: z.string().trim(),
    basis: z.enum(['NET', 'GROSS']),
    effectiveFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date this starts'),
    rules: z.array(ruleRowSchema),
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'COMMISSION' && rupeesToPaisa(v.salary) === null)
      ctx.addIssue({
        code: 'custom',
        path: ['salary'],
        message: 'Enter the monthly salary (max 2 decimals)',
      })
    if (v.type !== 'SALARY' && percentToBps(v.rate) === null)
      ctx.addIssue({
        code: 'custom',
        path: ['rate'],
        message: 'Enter a commission between 0 and 100%',
      })
    if (v.type !== 'SALARY') checkRules(v.rules, ctx)
  })
export type CompensationValues = z.infer<typeof compensationSchema>

export const rulesOnlySchema = z
  .object({ rules: z.array(ruleRowSchema) })
  .superRefine((v, ctx) => checkRules(v.rules, ctx))
export type RulesOnlyValues = z.infer<typeof rulesOnlySchema>

export function toRuleInputs(rows: RuleRow[]): CommissionRuleInput[] {
  return rows.map((r) => {
    const [kind, id] = r.target.split(':') as ['svc' | 'cat', string]
    const target =
      kind === 'svc'
        ? { serviceId: id }
        : { serviceCategory: id as ServiceKind }
    return r.mode === 'percent'
      ? { ...target, rateBps: percentToBps(r.value) as number }
      : { ...target, fixedAmountPaisa: rupeesToPaisa(r.value) as number }
  })
}

export function toPlanInput(v: CompensationValues): CompensationPlanInput {
  const earns = v.type !== 'SALARY'
  return {
    type: v.type,
    effectiveFrom: v.effectiveFrom,
    commissionBasis: v.basis,
    ...(v.type !== 'COMMISSION'
      ? { baseSalaryPaisa: rupeesToPaisa(v.salary) as number }
      : {}),
    ...(earns ? { defaultRateBps: percentToBps(v.rate) as number } : {}),
    rules: earns ? toRuleInputs(v.rules) : [],
  }
}
