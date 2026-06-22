import api from '@/lib/api'

/**
 * Result returned by the backend `POST /uploads` endpoint.
 * Mirrors the backend `UploadedFileResult` (storage-provider.interface.ts).
 */
export interface UploadedFileResult {
  url: string
  publicId: string
  fileName: string
  sizeBytes: number
  mimeType: string
  resourceType: string
}

/**
 * Upload a single file via the backend storage abstraction.
 * The backend decides the concrete provider (currently Cloudinary), so the
 * frontend never talks to a storage vendor directly.
 *
 * @param file   The File/Blob to upload.
 * @param folder Logical folder within storage (e.g. 'patient-documents').
 */
export async function uploadFile(
  file: File,
  folder?: string,
): Promise<UploadedFileResult> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await api.post('/uploads', formData, {
    params: folder ? { folder } : undefined,
    // Let the browser/axios set the multipart boundary by clearing the
    // instance default `application/json` content-type for this request.
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}
