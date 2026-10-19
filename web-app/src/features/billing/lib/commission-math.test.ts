import { describe, expect, it } from 'vitest'
import {
  bpsToPercent,
  formatPaisa,
  paisaToRupeesText,
  percentToBps,
  rupeesToPaisa,
} from './commission-math'

describe('commission-math (frontend)', () => {
  it('converts percent text to basis points exactly', () => {
    expect(percentToBps('40')).toBe(4000)
    expect(percentToBps('12.5')).toBe(1250)
    expect(percentToBps('0.07')).toBe(7)
    expect(percentToBps('33.33')).toBe(3333)
    expect(percentToBps('100')).toBe(10_000)
    expect(percentToBps('100.5')).toBeNull()
    expect(percentToBps('1.234')).toBeNull()
    expect(percentToBps('')).toBeNull()
  })

  it('round-trips bps and paisa to text', () => {
    expect(bpsToPercent(1250)).toBe('12.5')
    expect(bpsToPercent(4000)).toBe('40')
    expect(rupeesToPaisa('50000.5')).toBe(5_000_050)
    expect(rupeesToPaisa('0.1')).toBe(10)
    expect(rupeesToPaisa('1.005')).toBeNull()
    expect(paisaToRupeesText(5_000_050)).toBe('50000.5')
  })

  it('formats paisa without floats', () => {
    expect(formatPaisa(5_000_050)).toBe('PKR 50,000.50')
    expect(formatPaisa(40_000)).toBe('PKR 400')
    expect(formatPaisa(-1_234)).toBe('-PKR 12.34')
  })
})
