import type { PortalClinicParams, PortalOrderParams } from './types'

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
  orders: (labId: string | null, params: PortalOrderParams) =>
    ['lab-portal', labId, 'orders', params] as const,
  order: (labId: string | null, id: string) =>
    ['lab-portal', labId, 'order', id] as const,
  orderActions: (labId: string | null, id: string) =>
    ['lab-portal', labId, 'order', id, 'actions'] as const,
  magicLink: (token: string) => ['lab-link', token] as const,
}
