import { describe, expect, it } from 'vitest'
import { toPatientUpdateBody } from './patients.api'

describe('toPatientUpdateBody', () => {
  it('sends blank optional fields as null so the API clears them', () => {
    expect(
      toPatientUpdateBody({ dob: '', email: '', city: '', cnic: '' }),
    ).toEqual({ dob: null, email: null, city: null, cnic: null })
  })

  it('leaves out blank required fields instead of clearing them', () => {
    expect(toPatientUpdateBody({ fullName: '', phone: '' })).toEqual({})
  })

  it('passes filled values through unchanged', () => {
    expect(
      toPatientUpdateBody({
        fullName: 'Patient Two',
        dob: '1990-05-01',
        city: 'Lahore',
        isMinor: false,
        tags: [],
      }),
    ).toEqual({
      fullName: 'Patient Two',
      dob: '1990-05-01',
      city: 'Lahore',
      isMinor: false,
      tags: [],
    })
  })
})
