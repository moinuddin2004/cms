import api from '@/lib/api'

/**
 * Result returned by the backend `POST /uploads` endpoint.
 * Mirrors the backend `UploadedFileResult` (common/storage/storage.service.ts).
 */
export interface UploadedFileResult {
  url: string
  /** Storage key (provider-owned) — needed to delete the file later. */
  key: string
  fileName: string
  sizeBytes: number
  /** Real MIME type detected by the server from the file's bytes. */
  mimeType: string
}

/**
 * Upload a single file via the backend storage abstraction.
 * The backend decides the storage provider, so the frontend never talks to
 * a storage vendor directly.
 *
 * @param file   The File/Blob to upload.
 * @param folder Upload purpose the server allows: 'patient-documents' | 'branding'.
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
