import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  UploadApiErrorResponse,
  UploadApiResponse,
} from 'cloudinary';
import { Readable } from 'stream';
import {
  PutOptions,
  StorageProvider,
  StoredObject,
} from '../storage-provider.interface';

/**
 * Cloudinary implementation of `StorageProvider`. The ONLY file in the
 * backend that imports the Cloudinary SDK.
 *
 * Key format (opaque to the app): `<resource_type>|<type>|<public_id>`, e.g.
 * `image|upload|org/…/avatar-…` (public) or `raw|authenticated|org/…`
 * (private). Cloudinary needs resource_type + type again to sign or delete.
 *
 * Public files: `type: 'upload'`, resource_type auto (images and PDFs come
 * back as `image`). Private files: `type: 'authenticated'`, resource_type
 * `raw` (bytes stored as-is), readable only through signed, expiring URLs.
 */
@Injectable()
export class CloudinaryStorageProvider implements StorageProvider {
  readonly name = 'cloudinary';
  private readonly logger = new Logger(CloudinaryStorageProvider.name);

  constructor(config: ConfigService) {
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME');
    if (!cloudName) {
      this.logger.warn(
        'CLOUDINARY_CLOUD_NAME is not set — file uploads will fail',
      );
    }
    cloudinary.config({
      cloud_name: cloudName,
      api_key: config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: config.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  async put(
    path: string,
    body: Buffer,
    options: PutOptions,
  ): Promise<StoredObject> {
    const isPublic = options.visibility === 'public';
    // Cloudinary adds the extension itself for image/auto resources; raw
    // files keep it as part of the public_id.
    const publicId = isPublic ? path.replace(/\.[a-z0-9]+$/i, '') : path;
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: isPublic ? 'auto' : 'raw',
          type: isPublic ? 'upload' : 'authenticated',
          overwrite: false,
        },
        (err: UploadApiErrorResponse | undefined, res?: UploadApiResponse) =>
          err || !res
            ? reject(new Error(err?.message ?? 'Upload failed'))
            : resolve(res),
      );
      Readable.from(body).pipe(stream);
    });
    return {
      key: [result.resource_type, result.type, result.public_id].join('|'),
      url: isPublic ? result.secure_url : null,
    };
  }

  signedUrl(key: string, ttlSeconds: number): Promise<string> {
    const { resourceType, type, publicId } = this.parse(key);
    if (type === 'upload') {
      return Promise.resolve(
        cloudinary.url(publicId, {
          resource_type: resourceType,
          type,
          secure: true,
        }),
      );
    }
    return Promise.resolve(
      cloudinary.utils.private_download_url(publicId, '', {
        resource_type: resourceType,
        type,
        attachment: true,
        expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    if (!key) return;
    const { resourceType, type, publicId } = this.parse(key);
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        type,
        invalidate: true,
      });
    } catch (err) {
      this.logger.warn(
        `Could not delete ${publicId}: ${(err as Error).message}`,
      );
    }
  }

  private parse(key: string) {
    const [resourceType, type, ...rest] = key.split('|');
    if (!rest.length) {
      // Bare public_id (lab attachments stored before this format).
      return { resourceType: 'raw', type: 'authenticated', publicId: key };
    }
    return { resourceType, type, publicId: rest.join('|') };
  }
}
