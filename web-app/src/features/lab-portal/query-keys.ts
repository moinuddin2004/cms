import type { PortalClinicParams } from './types'

/**
 * Lab portal queries, keyed by the active lab so switching labs never shows
 * the previous lab's data.
 */
export const labPortalKeys = {
  all: ['lab-portal'] as const,
  me: ['lab-portal', 'me'] as const,
  lab: (labId: string | null) => ['lab-portal', labId, 'lab'] as const,
  members: (labId: string | null) => ['lab-portal', labId, 'members'] as const,
  clinics: (labId: string | null, params: PortalClinicParams) =>
    ['lab-portal', labId, 'clinics', params] as const,
}
