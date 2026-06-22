/**
 * Storage abstraction.
 *
 * Any concrete provider (Cloudinary, S3, GCS, local disk, ...) implements this
 * interface and is bound to the `STORAGE_PROVIDER` token in `StorageModule`.
 * Application code depends only on the interface, so swapping providers is a
 * one-line change in the module — no controller/service edits required.
 */

export interface UploadedFileResult {
  /** Public, servable URL (HTTPS). Stored on entities as `fileUrl` / `signatureUrl`. */
  url: string;
  /** Provider-specific identifier used for deletion. */
  publicId: string;
  /** Original file name as uploaded by the client. */
  fileName: string;
  /** File size in bytes. */
  sizeBytes: number;
  /** MIME type detected from the upload. */
  mimeType: string;
  /** Logical resource type: 'image' | 'raw' (pdf/docs) | 'video' | etc. */
  resourceType: string;
}

export interface UploadOptions {
  /** Logical folder/prefix within the storage bucket. */
  folder?: string;
}

export interface StorageProvider {
  /**
   * Persist a single uploaded file and return its public URL + metadata.
   * Implementations must validate type/size and throw `BadRequestException`
   * on invalid input.
   */
  upload(
    file: Express.Multer.File,
    options?: UploadOptions,
  ): Promise<UploadedFileResult>;

  /** Remove a previously-uploaded file. Must never throw for a missing id. */
  delete(publicId: string): Promise<void>;
}

/** DI token for the active storage provider. */
export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
