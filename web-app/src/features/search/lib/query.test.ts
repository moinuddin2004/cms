import { describe, expect, it } from 'vitest'
import { Users } from 'lucide-react'
import { filterStatic, isSearchable, splitMatch } from './query'
import type { StaticSearchItem } from '../types'

const item = (label: string, keywords?: string[]): StaticSearchItem => ({
  id: label,
  kind: 'page',
  label,
  keywords,
  icon: Users,
  href: '/x',
})

describe('isSearchable', () => {
  it('needs 2 letters or 3 digits', () => {
    expect(isSearchable('a')).toBe(false)
    expect(isSearchable('al')).toBe(true)
    expect(isSearchable('03')).toBe(false)
    expect(isSearchable('030')).toBe(true)
    expect(isSearchable(' + 3 ')).toBe(false)
  })
})

describe('filterStatic', () => {
  const items = [
    item('Lab orders'),
    item('Patients'),
    item('Payments'),
    item('Settings', ['theme', 'roles']),
  ]

  it('ranks label prefix before word prefix before keywords', () => {
    expect(filterStatic(items, 'pa').map((i) => i.label)).toEqual([
      'Patients',
      'Payments',
    ])
    expect(filterStatic(items, 'ord').map((i) => i.label)).toEqual([
      'Lab orders',
    ])
    expect(filterStatic(items, 'theme').map((i) => i.label)).toEqual([
      'Settings',
    ])
  })

  it('returns nothing for an empty query', () => {
    expect(filterStatic(items, '  ')).toEqual([])
  })
})

describe('splitMatch', () => {
  it('splits around a case-insensitive match', () => {
    expect(splitMatch('Muhammad Ali', 'ali')).toEqual({
      before: 'Muhammad ',
      match: 'Ali',
      after: '',
    })
    expect(splitMatch('Ali', 'zz')).toBeNull()
  })
})
