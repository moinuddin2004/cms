import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { labKeys } from '../query-keys'
import { labDirectoryApi } from '../services/labs.api'
import type {
  Lab,
  LabInput,
  LabListParams,
  LabMember,
  LabMemberRole,
  LabStatus,
} from '../types'
import { useLabMutation } from './useLabMutation'

// ── Queries (platform admin) ─────────────────────────────────────────────

export function useLabs(params: LabListParams) {
  return useQuery({
    queryKey: labKeys.directory.list(params),
    queryFn: () => labDirectoryApi.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useLab(id: string) {
  return useQuery({
    queryKey: labKeys.directory.detail(id),
    queryFn: () => labDirectoryApi.get(id),
  })
}

export function useLabMembers(id: string) {
  return useQuery({
    queryKey: labKeys.directory.members(id),
    queryFn: () => labDirectoryApi.members(id),
  })
}

export function useLabClinicLinks(id: string) {
  return useQuery({
    queryKey: labKeys.directory.links(id),
    queryFn: () => labDirectoryApi.links(id),
  })
}

export function useLabHistory(id: string) {
  return useQuery({
    queryKey: labKeys.directory.history(id),
    queryFn: () => labDirectoryApi.history(id),
  })
}

// ── Mutations ──────────────────────────────────────────────────────────

export function useSaveLab(lab: Lab | null) {
  return useLabMutation(
    (input: LabInput) =>
      lab
        ? labDirectoryApi.update(lab.id, {
            name: input.name,
            phone: input.phone,
            whatsappPhone: input.whatsappPhone,
            email: input.email,
            city: input.city,
            address: input.address,
            version: lab.version,
          })
        : labDirectoryApi.create(input),
    { success: lab ? 'Lab updated' : 'Lab created' },
  )
}

export function useSetLabStatus() {
  return useLabMutation(
    (v: { lab: Lab; status: LabStatus }) =>
      labDirectoryApi.setStatus(v.lab.id, v.status, v.lab.version),
    {
      success: (lab) =>
        lab.status === 'active' ? 'Lab activated' : 'Lab suspended',
    },
  )
}

export function useAddLabMember(labId: string) {
  return useLabMutation(
    (body: { email: string; role: LabMemberRole }) =>
      labDirectoryApi.addMember(labId, body),
    { success: 'Member added' },
  )
}

export function useUpdateLabMember(labId: string) {
  return useLabMutation(
    (v: { member: LabMember; role?: LabMemberRole; isActive?: boolean }) =>
      labDirectoryApi.updateMember(labId, v.member.id, {
        role: v.role,
        isActive: v.isActive,
        version: v.member.version,
      }),
    {
      success: (m) => (m.isActive ? 'Member updated' : 'Member deactivated'),
    },
  )
}
