/**
 * File storage abstraction — the ONLY contract a storage vendor implements.
 *
 * Application code never talks to a provider (or imports a vendor SDK): it
 * uses `StorageService`, which validates files, builds keys and calls the
 * active provider. Which provider is active is decided in ONE place:
 * `storage.config.ts` (`STORAGE_DRIVER` env). To move to S3 / R2 / GCS /
 * local disk: implement this interface in `providers/<name>.provider.ts`,
 * add it to the registry in `storage.config.ts`, set `STORAGE_DRIVER`.
 */

export type StorageVisibility = 'public' | 'private';

export interface PutOptions {
  /** Detected MIME type of the bytes. */
  contentType: string;
  /**
   * public  = anyone with the returned URL can read it (logos, avatars).
   * private = no public URL; read only through `signedUrl` (short-lived).
   */
  visibility: StorageVisibility;
}

export interface StoredObject {
  /**
   * Provider-owned identifier. Store it on the entity and pass it back to
   * `signedUrl` / `delete`. Opaque to the app (never parse it).
   */
  key: string;
  /** Permanent HTTPS URL for public objects; null for private ones. */
  url: string | null;
}

export interface StorageProvider {
  /** Short name for logs, e.g. 'cloudinary', 's3'. */
  readonly name: string;

  /**
   * Store `body` under `path` (a logical path such as
   * `org/<id>/patient-documents/<uuid>.pdf`, '/'-separated, may include an
   * extension). Overwrites nothing: callers pass unique paths.
   */
  put(path: string, body: Buffer, options: PutOptions): Promise<StoredObject>;

  /** A download URL for `key` valid for `ttlSeconds` (works for public and private objects). */
  signedUrl(
    key: string,
    ttlSeconds: number,
    options?: { downloadName?: string },
  ): Promise<string>;

  /** Remove an object. Must not throw when it is already gone. */
  delete(key: string): Promise<void>;
}

/** DI token for the active provider (bound in `storage.config.ts`). */
export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
