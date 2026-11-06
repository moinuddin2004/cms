import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import {
  BadRequestException,
  Controller,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { AnyMember } from 'src/access/decorators/access.decorators';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { FileKind, MAX_UPLOAD_BYTES } from './file-rules';
import { StorageService } from './storage.service';

/**
 * What a client may upload through the generic endpoint. The client names a
 * purpose; the server picks the file rules and the storage path — the
 * client never controls where a file lands.
 */
const PURPOSES: Record<string, { kind: FileKind; folder: string }> = {
  'patient-documents': { kind: 'document', folder: 'patient-documents' },
  branding: { kind: 'image', folder: 'branding' },
};

/**
 * Generic authenticated file upload: `multipart/form-data` with one `file`
 * field and `?folder=<purpose>` (one of PURPOSES). Returns the URL + key the
 * client then stores on the entity it belongs to.
 */
@AnyMember()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @RateLimit({ maxAttempts: 60, windowSeconds: 600 })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @ActiveTenant() tenant: { organizationId?: string | null },
    @Req() req: { user?: { uuid?: string } },
    @Query('folder') folder?: string,
  ) {
    const purpose = PURPOSES[folder ?? 'patient-documents'];
    if (!purpose) {
      throw new BadRequestException(
        `Unknown upload folder. Allowed: ${Object.keys(PURPOSES).join(', ')}`,
      );
    }
    // Platform branding (super admin without a clinic) goes under platform/.
    const owner = tenant?.organizationId
      ? `org/${tenant.organizationId}`
      : `platform/${req.user?.uuid ?? 'unknown'}`;
    const result = await this.storage.uploadPublic(
      file,
      purpose.kind,
      `${owner}/${purpose.folder}`,
    );
    return ResponseWrapper.success(result, 'File uploaded successfully');
  }
}
