import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { assertAllowedFile, EXTENSION_BY_MIME, FileKind } from './file-rules';
import {
  STORAGE_PROVIDER,
  StorageProvider,
  StorageVisibility,
  StoredObject,
} from './storage-provider.interface';

export interface UploadedFileResult {
  /** HTTPS URL to show / link the file (public uploads). */
  url: string;
  /** Storage key — keep it on the entity to delete or re-sign the file later. */
  key: string;
  /** Original file name as uploaded by the client. */
  fileName: string;
  sizeBytes: number;
  /** MIME type detected from the bytes. */
  mimeType: string;
}

/**
 * What the app uses for files. Knows nothing about any vendor — the
 * provider behind `STORAGE_PROVIDER` is chosen in `storage.config.ts`.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider,
  ) {}

  /**
   * Validate an uploaded file against `kind` (real type from its bytes,
   * size) and store it publicly under `<prefix>/<uuid>.<ext>`.
   */
  async uploadPublic(
    file: Express.Multer.File | undefined,
    kind: FileKind,
    prefix: string,
  ): Promise<UploadedFileResult> {
    const mimeType = assertAllowedFile(file, kind);
    const stored = await this.put(
      `${prefix}/${randomUUID()}.${EXTENSION_BY_MIME[mimeType]}`,
      file!.buffer,
      mimeType,
      'public',
    );
    return {
      url: stored.url!,
      key: stored.key,
      fileName: (file!.originalname || 'file').slice(0, 255),
      sizeBytes: file!.buffer.length,
      mimeType,
    };
  }

  /** Store bytes the server produced or already validated. */
  async put(
    path: string,
    body: Buffer,
    contentType: string,
    visibility: StorageVisibility,
  ): Promise<StoredObject> {
    return this.provider.put(path, body, { contentType, visibility });
  }

  signedUrl(
    key: string,
    ttlSeconds: number,
    options?: { downloadName?: string },
  ): Promise<string> {
    return this.provider.signedUrl(key, ttlSeconds, options);
  }

  /** Best effort: a failed delete is logged, never thrown. */
  async delete(key: string | null | undefined): Promise<void> {
    if (!key) return;
    try {
      await this.provider.delete(key);
    } catch (err) {
      this.logger.warn(
        `Could not delete stored file (${this.provider.name}): ${(err as Error).message}`,
      );
    }
  }
}
