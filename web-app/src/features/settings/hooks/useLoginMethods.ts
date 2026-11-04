import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  apiErrorMessage,
  fetchLoginMethods,
  linkGoogle,
  unlinkGoogle,
} from '@/features/auth'
import type { LoginMethods } from '@/features/auth'

export const loginMethodsKey = ['auth', 'login-methods'] as const

/** How the signed-in user can sign in: password and/or a linked Google account. */
export function useLoginMethods() {
  return useQuery({ queryKey: loginMethodsKey, queryFn: fetchLoginMethods })
}

export function useLinkGoogle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (credential: string) => linkGoogle(credential),
    onSuccess: (data: LoginMethods) => {
      qc.setQueryData(loginMethodsKey, data)
      toast.success('Google account linked', {
        description: 'You can now sign in with Google.',
      })
    },
    onError: (err) =>
      toast.error(apiErrorMessage(err, 'Could not link Google. Try again.')),
  })
}

export function useUnlinkGoogle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: unlinkGoogle,
    onSuccess: (data: LoginMethods) => {
      qc.setQueryData(loginMethodsKey, data)
      toast.success('Google account unlinked')
    },
    onError: (err) =>
      toast.error(apiErrorMessage(err, 'Could not unlink Google. Try again.')),
  })
}
