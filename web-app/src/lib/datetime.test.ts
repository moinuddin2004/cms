import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/useAuthStore'
import {
  clinicDateTimeToUtc,
  clinicDayBounds,
  clinicInputToUtc,
  clinicTimezone,
  formatDate,
  formatDateTime,
  formatTime,
  formatYmd,
  toClinicYmd,
  todayYmd,
  utcToClinicInput,
} from './datetime'

function activeLocationIn(timezone: string) {
  useAuthStore.setState({
    activeOrganizationId: 'org',
    activeLocationId: 'loc',
    accessibleOrganizations: [
      {
        id: 'org',
        name: 'Clinic',
        slug: 'clinic',
        accessSource: 'owner',
        specialtyTags: [],
        locations: [
          {
            id: 'loc',
            name: 'Main',
            code: 'M',
            isMainBranch: true,
            accessSource: 'owner',
            isPrimary: true,
            timezone,
          },
        ],
      },
    ],
  })
}

// The browser's own zone must never leak into clinic times.
const originalTz = process.env.TZ
beforeEach(() => {
  process.env.TZ = 'America/New_York'
  activeLocationIn('Asia/Karachi')
})
afterEach(() => {
  process.env.TZ = originalTz
  vi.useRealTimers()
})

describe('clinic datetime helpers', () => {
  it('uses the active location timezone', () => {
    expect(clinicTimezone()).toBe('Asia/Karachi')
  })

  it('turns clinic wall time into a UTC instant', () => {
    expect(clinicDateTimeToUtc('2026-11-02', '15:00')).toBe(
      '2026-11-02T10:00:00.000Z',
    )
    expect(clinicInputToUtc('2026-11-02T15:00')).toBe(
      '2026-11-02T10:00:00.000Z',
    )
  })

  it('shows a UTC instant on the clinic clock', () => {
    const iso = '2026-11-02T10:00:00.000Z'
    expect(formatTime(iso)).toBe('3:00 PM')
    expect(formatDateTime(iso)).toBe('Nov 2, 2026, 3:00 PM')
    expect(utcToClinicInput(iso)).toBe('2026-11-02T15:00')
  })

  it('handles half-hour offsets', () => {
    activeLocationIn('Asia/Kolkata')
    expect(clinicDateTimeToUtc('2026-11-02', '15:00')).toBe(
      '2026-11-02T09:30:00.000Z',
    )
  })

  it('puts a late-night instant on the clinic day, not the UTC day', () => {
    // 01:00 in Karachi on Nov 3 is still Nov 2 in UTC.
    expect(toClinicYmd('2026-11-02T20:00:00.000Z')).toBe('2026-11-03')
  })

  it('never shifts a calendar date', () => {
    expect(formatDate('2026-11-02')).toBe('Nov 2, 2026')
    expect(formatYmd('2026-11-02', 'dd MMM yyyy')).toBe('02 Nov 2026')
  })

  it('gives the clinic day bounds in UTC', () => {
    expect(clinicDayBounds('2026-11-02')).toEqual({
      start: '2026-11-01T19:00:00.000Z',
      end: '2026-11-02T18:59:59.999Z',
    })
  })

  it("reads today from the clinic's clock", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-02T20:00:00.000Z'))
    expect(todayYmd()).toBe('2026-11-03')
  })

  it('falls back to a dash for empty values', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDate('')).toBe('—')
  })
})
