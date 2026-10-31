import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { NumberInput } from './NumberInput'
import type { NumberInputProps } from './NumberInput'
import {
  decimalField,
  intField,
  moneyField,
  toNumber,
  toNumberOrNull,
} from '@/lib/zod-numbers'

function Harness(props: NumberInputProps) {
  const [value, setValue] = useState('')
  return (
    <NumberInput
      aria-label="n"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      {...props}
    />
  )
}

const type = (v: string) =>
  fireEvent.change(screen.getByLabelText('n'), { target: { value: v } })
const value = () => screen.getByLabelText<HTMLInputElement>('n').value

describe('NumberInput', () => {
  it('is a text field with a numeric keypad', () => {
    render(<Harness mode="integer" />)
    const el = screen.getByLabelText('n')
    expect(el.getAttribute('type')).toBe('text')
    expect(el.getAttribute('inputmode')).toBe('numeric')
  })

  it('integer mode accepts digits only', () => {
    render(<Harness mode="integer" />)
    type('12')
    expect(value()).toBe('12')
    for (const bad of ['12.5', '1e3', '-1', 'abc']) {
      type(bad)
      expect(value()).toBe('12')
    }
  })

  it('decimal mode allows one point and the configured decimals', () => {
    render(<Harness decimals={2} />)
    type('4500.')
    expect(value()).toBe('4500.')
    type('4500.75')
    expect(value()).toBe('4500.75')
    type('4500.755')
    expect(value()).toBe('4500.75')
    type('1.2.3')
    expect(value()).toBe('4500.75')
  })

  it('drops commas and spaces from a paste', () => {
    render(<Harness />)
    type('1,250.50')
    expect(value()).toBe('1250.50')
  })

  it('allows a minus sign only when asked', () => {
    render(<Harness mode="integer" allowNegative />)
    type('-5')
    expect(value()).toBe('-5')
  })
})

describe('zod number helpers', () => {
  const msg = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
    r.success ? undefined : r.error?.issues[0]?.message

  it('intField checks format, range and required', () => {
    const s = intField('Days', { min: 1, max: 365 })
    expect(s.safeParse('30').success).toBe(true)
    expect(msg(s.safeParse(''))).toBe('Days is required')
    expect(msg(s.safeParse('2.5'))).toBe('Days: enter a whole number')
    expect(msg(s.safeParse('0'))).toBe('Days must be between 1 and 365')
    expect(intField('Days', { required: false }).safeParse('').success).toBe(true)
  })

  it('decimalField and moneyField limit decimals', () => {
    expect(decimalField('Qty', { decimals: 3 }).safeParse('1.125').success).toBe(true)
    expect(msg(decimalField('Qty').safeParse('1.125'))).toBe(
      'Qty: enter a number (max 2 decimals)',
    )
    expect(moneyField('Price').safeParse('99.5').success).toBe(true)
    expect(msg(moneyField('Price', { min: 1 }).safeParse('0'))).toBe(
      'Price must be at least 1',
    )
  })

  it('converts on submit', () => {
    expect(toNumber('')).toBe(0)
    expect(toNumber('12.5')).toBe(12.5)
    expect(toNumberOrNull(' ')).toBeNull()
  })
})
