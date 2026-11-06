import { Injectable } from '@nestjs/common';
import { StorageService } from 'src/common/storage/storage.service';

/**
 * Private file storage for order attachments (lab ERD §11): files are
 * stored as non-public objects and read back only through short-lived
 * signed URLs. Bound to `ATTACHMENT_STORAGE`; tests swap in a fake.
 */
export interface AttachmentStorage {
  /** Stores the bytes under `key` and returns the storage key. */
  put(key: string, file: { buffer: Buffer; mimeType: string }): Promise<string>;
  /** A download URL valid for `ttlSeconds`. */
  signedUrl(storageKey: string, ttlSeconds: number): Promise<string>;
}

export const ATTACHMENT_STORAGE = 'LAB_ORDER_ATTACHMENT_STORAGE';

/** Signed-URL lifetime (lab ERD §11: 10–15 minutes). */
export const SIGNED_URL_TTL_SECONDS = 10 * 60;

/** Private objects through the app's storage provider (any vendor). */
@Injectable()
export class PrivateAttachmentStorage implements AttachmentStorage {
  constructor(private readonly storage: StorageService) {}

  async put(
    key: string,
    file: { buffer: Buffer; mimeType: string },
  ): Promise<string> {
    const stored = await this.storage.put(
      key,
      file.buffer,
      file.mimeType || 'application/octet-stream',
      'private',
    );
    return stored.key;
  }

  signedUrl(storageKey: string, ttlSeconds: number): Promise<string> {
    return this.storage.signedUrl(storageKey, ttlSeconds);
  }
}
