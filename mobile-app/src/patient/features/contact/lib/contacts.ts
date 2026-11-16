import type { PatientLink } from '@/patient/features/clinics';
import type { LocationRef } from '@/patient/lib/clinic-types';

export interface ClinicContact {
  /** Stable key: the location id. */
  key: string;
  clinicName: string;
  locationName: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
}

/**
 * One contact per (clinic, location) the patient is linked to: revoked links are
 * gone from the app, and several family members at the same location collapse to one.
 * Rows with no way to reach the clinic are dropped.
 */
export function buildContacts(links: readonly PatientLink[]): ClinicContact[] {
  const seen = new Set<string>();
  const out: ClinicContact[] = [];
  for (const link of links) {
    const loc: LocationRef | null = link.location;
    if (link.status === 'revoked' || !loc || seen.has(loc.id)) continue;
    if (!loc.phone && !loc.whatsapp && !loc.address) continue;
    seen.add(loc.id);
    out.push({
      key: loc.id,
      clinicName: link.clinic.name,
      locationName: loc.name,
      phone: loc.phone,
      whatsapp: loc.whatsapp,
      address: loc.address,
    });
  }
  return out.sort((a, b) => a.clinicName.localeCompare(b.clinicName));
}

const digits = (v: string) => v.replace(/\D+/g, '');

/** `tel:` link; keeps a leading + and digits only (the number is never logged). */
export function telUrl(phone: string): string | null {
  const d = digits(phone);
  if (d.length < 3) return null;
  return `tel:${phone.trim().startsWith('+') ? '+' : ''}${d}`;
}

/** `https://wa.me/<number>` wants the international number, digits only (docs/06 P-07). */
export function whatsappUrl(number: string): string | null {
  const d = digits(number);
  return d.length >= 6 ? `https://wa.me/${d}` : null;
}

export const mapsUrl = (address: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
