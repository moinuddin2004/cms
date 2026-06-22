import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Query,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import {
  StorageProvider,
  STORAGE_PROVIDER,
} from './storage-provider.interface';

/**
 * Generic authenticated file-upload endpoint.
 *
 * Clients POST `multipart/form-data` with a single `file` field and an optional
 * `folder` query param. Returns the public URL + metadata, which the client
 * then stores on the relevant entity (document `fileUrl`, consent `signatureUrl`,
 * insurance card images, etc.).
 *
 * Auth: `JwtAuthGuard` + `TenantContextGuard` apply globally, so only
 * authenticated users with a valid tenant context can upload.
 */
@Controller('uploads')
export class UploadsController {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const result = await this.storage.upload(file, { folder });
    return ResponseWrapper.success(result, 'File uploaded successfully');
  }
}
