import { z } from 'zod'

// Number fields are edited as strings (see `NumberInput`) and converted on
// submit, so an empty box stays '' instead of turning into NaN / 0.

interface NumberFieldOptions {
  min?: number
  max?: number
  /** false = '' is allowed (optional field). Default true. */
  required?: boolean
}

function rangeMessage(label: string, min?: number, max?: number) {
  if (min !== undefined && max !== undefined)
    return `${label} must be between ${min} and ${max}`
  if (min !== undefined) return `${label} must be at least ${min}`
  return `${label} must be at most ${max}`
}

function numberField(
  label: string,
  pattern: RegExp,
  formatMessage: string,
  { min, max, required = true }: NumberFieldOptions,
) {
  return z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (v === '') {
        if (required)
          ctx.addIssue({ code: 'custom', message: `${label} is required` })
        return
      }
      if (!pattern.test(v)) {
        ctx.addIssue({ code: 'custom', message: formatMessage })
        return
      }
      const n = Number(v)
      if ((min !== undefined && n < min) || (max !== undefined && n > max))
        ctx.addIssue({ code: 'custom', message: rangeMessage(label, min, max) })
    })
}

/** A whole number typed as a string, e.g. a quantity or a number of days. */
export const intField = (label: string, opts: NumberFieldOptions = {}) =>
  numberField(label, /^\d+$/, `${label}: enter a whole number`, opts)

/** A number with up to `decimals` digits after the point (default 2). */
export const decimalField = (
  label: string,
  { decimals = 2, ...opts }: NumberFieldOptions & { decimals?: number } = {},
) =>
  numberField(
    label,
    new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`),
    `${label}: enter a number (max ${decimals} decimals)`,
    opts,
  )

/** Rupees with up to 2 decimals; min defaults to 0. */
export const moneyField = (label: string, opts: NumberFieldOptions = {}) =>
  numberField(
    label,
    /^\d+(\.\d{1,2})?$/,
    `${label}: enter an amount (max 2 decimals)`,
    { min: 0, ...opts },
  )

/** '' → null, otherwise the number (for optional fields on submit). */
export const toNumberOrNull = (v: string | null | undefined): number | null =>
  v == null || v.trim() === '' ? null : Number(v)

/** '' → 0, otherwise the number. */
export const toNumber = (v: string | null | undefined): number =>
  toNumberOrNull(v) ?? 0

/** A number from the API → the string a NumberInput edits ('' for null). */
export const toInputValue = (v: number | string | null | undefined): string =>
  v == null ? '' : String(v)
