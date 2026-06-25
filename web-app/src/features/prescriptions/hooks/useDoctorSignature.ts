import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  deleteMySignature,
  fetchMySignature,
  saveMySignature,
} from '../services/prescriptions.api'

export const MY_SIGNATURE_KEY = 'my-signature'

function errMsg(err: any, fallback: string): string {
  return err?.response?.data?.message || fallback
}

export function useMySignature() {
  return useQuery({
    queryKey: [MY_SIGNATURE_KEY],
    queryFn: () => fetchMySignature(),
  })
}

export function useSaveMySignature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { signatureImageUrl: string; signatureData?: string }) =>
      saveMySignature(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MY_SIGNATURE_KEY] })
      toast.success('Signature saved')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save signature')),
  })
}

export function useDeleteMySignature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => deleteMySignature(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MY_SIGNATURE_KEY] })
      toast.success('Signature removed')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to remove signature')),
  })
}
