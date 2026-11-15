import { isPersistableKey } from '@/patient/lib/persist';

import { recordKeys } from '../api/records.keys';
import type { BillingClinic, ClinicRef } from '../types/records.types';
import { clinicAccent, isClinicPaused } from './clinic';
import {
  appointmentTone,
  appointmentTypeKey,
  timingKey,
  formatIssuedDate,
  formatMinor,
  formatRecordDate,
  formatRecordTime,
  matchesQuery,
  toBillRows,
} from './records-format';

const clinic = (over: Partial<ClinicRef> = {}): ClinicRef => ({
  organizationId: 'o',
  name: 'City Dental',
  logoUrl: null,
  brandColor: '#112233',
  clinicStatus: 'active',
  ...over,
});

describe('record times use the clinic clock', () => {
  it('shows an instant on the record timezone, not the phone', () => {
    // 2026-11-03T11:30Z is 16:30 in Karachi (UTC+5) and 12:30 in London (UTC+0).
    expect(formatRecordTime('2026-11-03T11:30:00.000Z', { timezone: 'Asia/Karachi' })).toBe(
      'Tue, 3 Nov · 4:30 PM',
    );
    expect(formatRecordTime('2026-11-03T11:30:00.000Z', { timezone: 'Europe/London' })).toBe(
      'Tue, 3 Nov · 11:30 AM',
    );
  });
  it('rolls the calendar day with the zone', () => {
    expect(formatIssuedDate('2026-11-03T22:30:00.000Z', { timezone: 'Asia/Karachi' })).toBe('4 Nov 2026');
  });
  it('formats calendar dates without a shift', () => {
    expect(formatRecordDate('2026-11-03')).toBe('3 Nov 2026');
    expect(formatRecordDate(null)).toBe('—');
  });
});

describe('code labels', () => {
  it('maps known backend codes and leaves unknown ones to the caller', () => {
    expect(appointmentTypeKey('follow_up')).toBe('records.appointment.types.follow_up');
    expect(appointmentTypeKey('weird')).toBeNull();
    expect(timingKey('sos')).toBe('records.prescription.timing.sos');
    expect(timingKey('noon-ish')).toBeNull();
  });
});

describe('money', () => {
  it('converts minor units', () => expect(formatMinor(250050, 'PKR')).toBe('PKR 2,500.50'));
});

describe('clinic helpers', () => {
  it('accepts only hex accents', () => {
    expect(clinicAccent(clinic())).toBe('#112233');
    expect(clinicAccent(clinic({ brandColor: 'red; x' }))).toBeNull();
    expect(clinicAccent(clinic({ brandColor: null }))).toBeNull();
  });
  it('flags a suspended clinic', () => {
    expect(isClinicPaused(clinic({ clinicStatus: 'suspended' }))).toBe(true);
    expect(isClinicPaused(clinic())).toBe(false);
  });
});

describe('lists', () => {
  it('flattens invoices newest first', () => {
    const inv = (id: string, issuedAt: string) => ({
      id,
      profileId: 'p',
      number: id,
      issuedAt,
      timezone: 'Asia/Karachi',
      totalMinor: 1,
      paidMinor: 0,
      balanceMinor: 1,
      status: 'unpaid' as const,
    });
    const clinics: BillingClinic[] = [
      { clinic: clinic(), currency: 'PKR', billedMinor: 2, paidMinor: 0, balanceMinor: 2, invoices: [inv('a', '2026-01-01T00:00:00Z'), inv('c', '2026-03-01T00:00:00Z')] },
      { clinic: clinic({ name: 'B' }), currency: 'PKR', billedMinor: 1, paidMinor: 0, balanceMinor: 1, invoices: [inv('b', '2026-02-01T00:00:00Z')] },
    ];
    expect(toBillRows(clinics).map((r) => r.invoice.id)).toEqual(['c', 'b', 'a']);
  });
  it('searches case-insensitively over any field', () => {
    expect(matchesQuery(' dental ', ['City Dental', null])).toBe(true);
    expect(matchesQuery('xyz', ['City Dental', null])).toBe(false);
    expect(matchesQuery('', [])).toBe(true);
  });
  it('maps unknown appointment statuses to neutral', () => {
    expect(appointmentTone('completed')).toBe('success');
    expect(appointmentTone('something_new')).toBe('neutral');
  });
});

describe('cache keys', () => {
  it('carry the account id', () => {
    expect(recordKeys.appointments('acc', null)).toContain('acc');
    expect(recordKeys.prescription('acc', 'x')).toContain('acc');
  });
  it('persist only upcoming appointments and the prescription list', () => {
    expect(isPersistableKey(recordKeys.appointmentsUpcoming('a', null))).toBe(true);
    expect(isPersistableKey(recordKeys.prescriptions('a', null))).toBe(true);
    expect(isPersistableKey(recordKeys.appointments('a', null))).toBe(false);
    expect(isPersistableKey(recordKeys.visits('a', null))).toBe(false);
    expect(isPersistableKey(recordKeys.billing('a', null))).toBe(false);
    expect(isPersistableKey(recordKeys.prescription('a', 'x'))).toBe(false);
  });
});
