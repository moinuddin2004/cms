import api from '@/lib/api'
import type {
  DirectoryLab,
  Lab,
  LabInput,
  LabLink,
  LabLinkAction,
  LabLinkAdmin,
  LabLinkListParams,
  LabLinkTermsInput,
  LabListParams,
  LabMember,
  LabMemberRole,
  LabStatus,
  Paginated,
  TimelineEntry,
} from '../types'

async function get<T>(url: string, params?: object): Promise<T> {
  const { data } = await api.get(url, { params })
  return data.data as T
}
async function post<T>(url: string, body?: object): Promise<T> {
  const { data } = await api.post(url, body)
  return data.data as T
}
async function patch<T>(url: string, body: object): Promise<T> {
  const { data } = await api.patch(url, body)
  return data.data as T
}

/** Platform lab directory — super admins only. */
export const labDirectoryApi = {
  list: (params: LabListParams) =>
    get<Paginated<Lab>>('/platform/labs', params),
  get: (id: string) => get<Lab>(`/platform/labs/${id}`),
  create: (body: LabInput) => post<Lab>('/platform/labs', body),
  update: (id: string, body: Partial<LabInput> & { version: number }) =>
    patch<Lab>(`/platform/labs/${id}`, body),
  setStatus: (id: string, status: LabStatus, version: number) =>
    post<Lab>(`/platform/labs/${id}/status`, { status, version }),
  links: (id: string) => get<LabLinkAdmin[]>(`/platform/labs/${id}/links`),
  history: (id: string) => get<TimelineEntry[]>(`/platform/labs/${id}/history`),
  members: (id: string) => get<LabMember[]>(`/platform/labs/${id}/members`),
  addMember: (id: string, body: { email: string; role: LabMemberRole }) =>
    post<LabMember>(`/platform/labs/${id}/members`, body),
  updateMember: (
    id: string,
    memberId: string,
    body: { role?: LabMemberRole; isActive?: boolean; version: number },
  ) => patch<LabMember>(`/platform/labs/${id}/members/${memberId}`, body),
}

/** The active clinic's lab list. */
export const labLinksApi = {
  list: (params: LabLinkListParams) =>
    get<Paginated<LabLink>>('/lab-links', params),
  available: (search: string) =>
    get<DirectoryLab[]>('/lab-links/directory', search ? { search } : {}),
  create: (body: { labId: string } & Partial<LabLinkTermsInput>) =>
    post<LabLink>('/lab-links', body),
  update: (
    id: string,
    body: Partial<LabLinkTermsInput> & { version: number },
  ) => patch<LabLink>(`/lab-links/${id}`, body),
  transition: (
    id: string,
    body: { action: LabLinkAction; version: number; reason?: string },
  ) => post<LabLink>(`/lab-links/${id}/transitions`, body),
  history: (id: string) => get<TimelineEntry[]>(`/lab-links/${id}/history`),
}
