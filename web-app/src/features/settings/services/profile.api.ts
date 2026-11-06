import api from '@/lib/api'

/** The fields of the backend `UserDto` the profile photo flow needs. */
export interface ProfilePhotoResult {
  avatarUrl?: string | null
}

/** Upload the signed-in user's profile photo (JPG/PNG/WebP, max 2 MB). */
export async function uploadMyAvatar(file: File): Promise<ProfilePhotoResult> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.put('/user/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

/** Remove the signed-in user's profile photo. */
export async function removeMyAvatar(): Promise<ProfilePhotoResult> {
  const { data } = await api.delete('/user/me/avatar')
  return data.data
}
