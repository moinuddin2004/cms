import type { LabLinkListParams, LabListParams } from './types'

/** Every labs query lives under one root, so a mutation can refresh them all. */
export const labKeys = {
  all: ['labs'] as const,
  directory: {
    all: ['labs', 'directory'] as const,
    list: (params: LabListParams) =>
      ['labs', 'directory', 'list', params] as const,
    detail: (id: string) => ['labs', 'directory', 'detail', id] as const,
    members: (id: string) => ['labs', 'directory', 'members', id] as const,
    links: (id: string) => ['labs', 'directory', 'links', id] as const,
    history: (id: string) => ['labs', 'directory', 'history', id] as const,
  },
  links: {
    all: ['labs', 'links'] as const,
    list: (params: LabLinkListParams) =>
      ['labs', 'links', 'list', params] as const,
    available: (search: string) =>
      ['labs', 'links', 'available', search] as const,
    history: (id: string) => ['labs', 'links', 'history', id] as const,
  },
}
