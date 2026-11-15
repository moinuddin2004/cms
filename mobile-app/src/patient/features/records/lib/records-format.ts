import { formatInZone } from '@/core/datetime';
import { formatMoney } from '@/core/money/format';
import {
  APPOINTMENT_STATUS_TONES,
  type StatusTone,
} from '@/core/components/data-display/status-tones';

import type {
  BillRow,
  BillingClinic,
  InvoiceStatus,
  LocationRef,
} from '../types/records.types';

/** "Tue, 3 Nov · 4:30 PM" on the RECORD's clinic clock — never the phone's. */
export const formatRecordTime = (instant: string, location: Pick<LocationRef, 'timezone'>) =>
  formatInZone(instant, location.timezone, 'EEE, d MMM · h:mm a');

/** A visit/follow-up calendar date (no timezone shift). */
export const formatRecordDate = (ymd: string | null | undefined) =>
  formatInZone(ymd, 'UTC', 'd MMM yyyy');

/** Prescription issue date on its clinic's clock. */
export const formatIssuedDate = (instant: string, location: Pick<LocationRef, 'timezone'>) =>
  formatInZone(instant, location.timezone, 'd MMM yyyy');

/** `*Minor` amounts are decimal × 100. */
export const formatMinor = (minor: number, currency: string) => formatMoney(minor / 100, currency);

export function appointmentTone(status: string): StatusTone {
  return (APPOINTMENT_STATUS_TONES as Record<string, { tone: StatusTone } | undefined>)[status]?.tone ?? 'neutral';
}

export const INVOICE_TONES: Record<InvoiceStatus, StatusTone> = {
  paid: 'success',
  partial: 'warning',
  unpaid: 'neutral',
  overdue: 'destructive',
};

/** Flat, newest-first list of invoices across the linked clinics. */
export function toBillRows(clinics: BillingClinic[]): BillRow[] {
  return clinics
    .flatMap((c) => c.invoices.map((invoice) => ({ invoice, clinic: c.clinic, currency: c.currency })))
    .sort((a, b) => b.invoice.issuedAt.localeCompare(a.invoice.issuedAt));
}

/** Case-insensitive match of the search text against any of the given fields. */
export function matchesQuery(query: string, fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => !!f && f.toLowerCase().includes(q));
}
