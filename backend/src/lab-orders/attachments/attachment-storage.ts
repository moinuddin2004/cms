import { Injectable } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiErrorResponse,
  UploadApiResponse,
} from 'cloudinary';
import { Readable } from 'stream';

/**
 * Private file storage for order attachments (lab ERD §11): files are
 * uploaded as non-public objects and read back only through short-lived
 * signed URLs. Bound to `ATTACHMENT_STORAGE`; tests swap in a fake.
 */
export interface AttachmentStorage {
  /** Stores the bytes under `key` (no extension) and returns the storage key. */
  put(key: string, file: { buffer: Buffer; mimeType: string }): Promise<string>;
  /** A download URL valid for `ttlSeconds`. */
  signedUrl(storageKey: string, ttlSeconds: number): string;
}

export const ATTACHMENT_STORAGE = 'LAB_ORDER_ATTACHMENT_STORAGE';

/** Signed-URL lifetime (lab ERD §11: 10–15 minutes). */
export const SIGNED_URL_TTL_SECONDS = 10 * 60;

/**
 * Cloudinary with `type: 'authenticated'` — the object has no public URL;
 * `private_download_url` signs an expiring one. Reuses the SDK config set
 * up by the global `CloudinaryModule`.
 */
@Injectable()
export class CloudinaryAttachmentStorage implements AttachmentStorage {
  async put(
    key: string,
    file: { buffer: Buffer; mimeType: string },
  ): Promise<string> {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: key, resource_type: 'raw', type: 'authenticated' },
        (err: UploadApiErrorResponse | undefined, res?: UploadApiResponse) =>
          err || !res
            ? reject(new Error(err?.message ?? 'Upload failed'))
            : resolve(res),
      );
      Readable.from(file.buffer).pipe(stream);
    });
    return result.public_id;
  }

  signedUrl(storageKey: string, ttlSeconds: number): string {
    return cloudinary.utils.private_download_url(storageKey, '', {
      resource_type: 'raw',
      type: 'authenticated',
      attachment: true,
      expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
    });
  }
}
