import api from '@/lib/api'
import type {
  LabContactInput,
  LabMember,
  LabMemberRole,
  LabMembership,
  PortalClinic,
  PortalClinicParams,
  PortalLab,
  PortalLinkAction,
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

/**
 * The lab portal API. The axios client adds `x-lab-id` (the active lab)
 * and leaves out clinic headers on every `/lab-portal` request.
 */
export const labPortalApi = {
  me: () => get<{ labs: LabMembership[] }>('/lab-portal/me'),
  lab: () => get<PortalLab>('/lab-portal/lab'),
  updateLab: (body: Partial<LabContactInput> & { version: number }) =>
    patch<PortalLab>('/lab-portal/lab', body),
  members: () => get<LabMember[]>('/lab-portal/members'),
  addMember: (body: { email: string; role: LabMemberRole }) =>
    post<LabMember>('/lab-portal/members', body),
  updateMember: (
    memberId: string,
    body: { role?: LabMemberRole; isActive?: boolean; version: number },
  ) => patch<LabMember>(`/lab-portal/members/${memberId}`, body),
  clinics: (params: PortalClinicParams) =>
    get<PortalClinic[]>('/lab-portal/clinics', params),
  transitionClinic: (
    linkId: string,
    body: { action: PortalLinkAction; version: number; reason?: string },
  ) => post<PortalClinic>(`/lab-portal/clinics/${linkId}/transitions`, body),
}
