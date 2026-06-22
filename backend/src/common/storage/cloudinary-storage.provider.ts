import { Injectable, BadRequestException } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import { Readable } from 'stream';
import { AppLogger } from '../services/logger.service';
import {
  StorageProvider,
  UploadOptions,
  UploadedFileResult,
} from './storage-provider.interface';

/**
 * Cloudinary-backed implementation of {@link StorageProvider}.
 *
 * Unlike `CloudinaryService` (which is avatar-specific: face-crop + image only),
 * this provider accepts general patient files — images AND documents (PDF) —
 * using `resource_type: 'auto'` and no destructive transformations.
 *
 * Cloudinary global config is initialised by `CloudinaryProvider` (CLOUDINARY
 * token) in the globally-imported `CloudinaryModule`, so the SDK is ready here.
 */
@Injectable()
export class CloudinaryStorageProvider implements StorageProvider {
  private static readonly MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

  private static readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'application/pdf',
  ];

  constructor(private readonly logger: AppLogger) {}

  async upload(
    file: Express.Multer.File,
    options: UploadOptions = {},
  ): Promise<UploadedFileResult> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    if (
      !CloudinaryStorageProvider.ALLOWED_MIME_TYPES.includes(file.mimetype)
    ) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: ${CloudinaryStorageProvider.ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (file.size > CloudinaryStorageProvider.MAX_SIZE_BYTES) {
      throw new BadRequestException('File size exceeds the 15MB limit');
    }

    const folder = options.folder || 'patient-files';

    this.logger.info(
      `Uploading file "${file.originalname}" (${file.size} bytes) to ${folder}`,
      CloudinaryStorageProvider.name,
    );

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
        },
        (
          error: UploadApiErrorResponse | undefined,
          uploaded: UploadApiResponse | undefined,
        ) => {
          if (error) {
            this.logger.error(
              `Cloudinary upload failed: ${error.message}`,
              CloudinaryStorageProvider.name,
            );
            reject(new BadRequestException('Failed to upload file to storage'));
          } else if (uploaded) {
            resolve(uploaded);
          } else {
            reject(new BadRequestException('Failed to upload file to storage'));
          }
        },
      );

      const readable = new Readable();
      readable.push(file.buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      fileName: file.originalname,
      sizeBytes: file.size,
      mimeType: file.mimetype,
      resourceType: result.resource_type,
    };
  }

  async delete(publicId: string): Promise<void> {
    if (!publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId);
      this.logger.info(
        `Deleted file: ${publicId}`,
        CloudinaryStorageProvider.name,
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to delete file ${publicId}: ${error?.message}`,
        CloudinaryStorageProvider.name,
      );
      // Swallow — deletion failure must not break the main operation.
    }
  }
}
