import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/features/auth'
import { useAuthStore } from '@/store/useAuthStore'
import { removeMyAvatar, uploadMyAvatar } from '../services/profile.api'
import type { ProfilePhotoResult } from '../services/profile.api'

/** Same rules as the backend (`FILE_KINDS.avatar`): checked before upload. */
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp'
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

/** Returns an error message, or null when the file may be uploaded. */
export function avatarFileError(file: File): string | null {
  if (!AVATAR_ACCEPT.split(',').includes(file.type))
    return 'Choose a JPG, PNG or WebP image.'
  if (file.size > AVATAR_MAX_BYTES) return 'The photo must be 2 MB or smaller.'
  return null
}

function applyToSession(res: ProfilePhotoResult) {
  useAuthStore.setState((s) => ({
    user: s.user
      ? { ...s.user, avatarUrl: res.avatarUrl ?? undefined }
      : s.user,
  }))
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: (file: File) => uploadMyAvatar(file),
    onSuccess: (res) => {
      applyToSession(res)
      toast.success('Profile photo updated')
    },
    onError: (err) =>
      toast.error(
        apiErrorMessage(err, 'Could not upload the photo. Try again.'),
      ),
  })
}

export function useRemoveAvatar() {
  return useMutation({
    mutationFn: removeMyAvatar,
    onSuccess: (res) => {
      applyToSession(res)
      toast.success('Profile photo removed')
    },
    onError: (err) =>
      toast.error(
        apiErrorMessage(err, 'Could not remove the photo. Try again.'),
      ),
  })
}
