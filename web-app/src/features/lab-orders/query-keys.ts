import type { LabOrderParams } from './types'

/** Every lab-order query under one root, so a mutation refreshes them all. */
export const labOrderKeys = {
  all: ['lab-orders'] as const,
  list: (params: LabOrderParams) => ['lab-orders', 'list', params] as const,
  detail: (id: string) => ['lab-orders', 'detail', id] as const,
  magicLinks: (id: string) =>
    ['lab-orders', 'detail', id, 'magic-links'] as const,
  proxyActions: (id: string) =>
    ['lab-orders', 'detail', id, 'proxy-actions'] as const,
}
