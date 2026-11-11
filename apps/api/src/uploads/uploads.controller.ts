import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { STORAGE_ADAPTER, StorageAdapter } from './storage/storage-adapter.interface';
import { MAX_FILE_SIZE_BYTES, imageFileFilter } from './upload-validation';

/**
 * UploadsController
 * Image upload for product images. Admin-only. The actual storage backend (local
 * disk for development, S3 in production) is selected by STORAGE_DRIVER and
 * injected as STORAGE_ADAPTER - see storage/storage.provider.ts. This controller
 * only validates the incoming file and delegates persistence to that adapter; the
 * response shape (url, filename, size, mimeType) is unchanged regardless of backend.
 */
@UseGuards(AuthGuard, AdminGuard, PermissionGuard)
@RequirePermission('uploads:manage')
@Controller('api/uploads')
export class UploadsController {
  constructor(@Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }

    // A storage failure here (disk full, S3 unreachable, misconfigured bucket) is not the
    // caller's fault, so it's a 500, not a 400. There's nothing on disk to clean up either
    // way - the interceptor buffers the upload in memory rather than writing a temp file.
    let stored;
    try {
      stored = await this.storage.save(file, { protocol: req.protocol, host: req.get('host') });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? `Upload failed: ${error.message}` : 'Upload failed',
      );
    }

    return {
      url: stored.url,
      filename: stored.key,
      size: file.size,
      mimeType: file.mimetype,
    };
  }
}
