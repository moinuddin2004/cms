import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { labKeys } from '../query-keys'
import { labLinksApi } from '../services/labs.api'
import type {
  LabLink,
  LabLinkAction,
  LabLinkListParams,
  LabLinkTermsInput,
} from '../types'
import { useLabMutation } from './useLabMutation'

export function useLabLinks(params: LabLinkListParams) {
  return useQuery({
    queryKey: labKeys.links.list(params),
    queryFn: () => labLinksApi.list(params),
    placeholderData: keepPreviousData,
  })
}

/** Labs the clinic can still add (platform directory + own in-house labs). */
export function useAvailableLabs(search: string, enabled: boolean) {
  return useQuery({
    queryKey: labKeys.links.available(search),
    queryFn: () => labLinksApi.available(search),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useLabLinkHistory(id: string | null) {
  return useQuery({
    queryKey: labKeys.links.history(id ?? ''),
    queryFn: () => labLinksApi.history(id!),
    enabled: !!id,
  })
}

export function useSaveLabLink(link: LabLink | null) {
  return useLabMutation(
    (v: LabLinkTermsInput & { labId?: string }) =>
      link
        ? labLinksApi.update(link.id, {
            paymentTermsDays: v.paymentTermsDays,
            patientDataLevel: v.patientDataLevel,
            notes: v.notes,
            version: link.version,
          })
        : labLinksApi.create({
            labId: v.labId!,
            paymentTermsDays: v.paymentTermsDays,
            patientDataLevel: v.patientDataLevel,
            notes: v.notes,
          }),
    { success: link ? 'Lab terms saved' : 'Lab added to your list' },
  )
}

export function useLabLinkTransition() {
  return useLabMutation(
    (v: { link: LabLink; action: LabLinkAction; reason?: string }) =>
      labLinksApi.transition(v.link.id, {
        action: v.action,
        version: v.link.version,
        reason: v.reason,
      }),
    {
      success: (l) =>
        l.status === 'suspended' ? 'Lab suspended' : 'Lab is active',
    },
  )
}
