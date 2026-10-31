import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface NumberInputProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'inputMode'> {
  /** `integer` = digits only; `decimal` = digits + one point. */
  mode?: 'integer' | 'decimal'
  /** Max digits after the point in `decimal` mode. */
  decimals?: number
  /** Allow a leading minus sign. */
  allowNegative?: boolean
}

function allowedPattern(
  mode: 'integer' | 'decimal',
  decimals: number,
  allowNegative: boolean,
) {
  const sign = allowNegative ? '-?' : ''
  return mode === 'integer'
    ? new RegExp(`^${sign}\\d*$`)
    : new RegExp(`^${sign}\\d*(\\.\\d{0,${decimals}})?$`)
}

/**
 * Numeric text field. shadcn has no number input, and the native
 * `type="number"` brings spinner arrows, wheel-to-change and lets
 * `e`/`+`/`-` through — so this is a plain text `Input` that only accepts
 * keystrokes / pastes that keep it a valid partial number (commas and
 * spaces in a paste are dropped). The value stays a string; check it with
 * the `@/lib/zod-numbers` helpers and convert on submit.
 *
 *   <NumberInput mode="decimal" value={field.state.value}
 *     onChange={(e) => field.handleChange(e.target.value)}
 *     onBlur={field.handleBlur} />
 */
export function NumberInput({
  mode = 'decimal',
  decimals = 2,
  allowNegative = false,
  className,
  onChange,
  ...props
}: NumberInputProps) {
  const pattern = React.useMemo(
    () => allowedPattern(mode, decimals, allowNegative),
    [mode, decimals, allowNegative],
  )
  return (
    <Input
      type="text"
      inputMode={mode === 'integer' && !allowNegative ? 'numeric' : 'decimal'}
      autoComplete="off"
      className={cn('tabular-nums', className)}
      onChange={(e) => {
        const raw = e.target.value
        const cleaned = raw.replace(/[,\s]/g, '')
        if (!pattern.test(cleaned)) return
        if (cleaned !== raw) e.target.value = cleaned
        onChange?.(e)
      }}
      {...props}
    />
  )
}
