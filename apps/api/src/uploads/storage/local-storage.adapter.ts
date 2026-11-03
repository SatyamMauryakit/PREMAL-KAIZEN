import { Injectable } from '@nestjs/common';
import { extname, join } from 'path';
import { promises as fs } from 'fs';
import * as crypto from 'crypto';
import { StorageAdapter, StoredFile, UploadRequestContext } from './storage-adapter.interface';

/**
 * LocalStorageAdapter
 * Writes uploaded files to apps/api/uploads/ and serves them via the static route
 * configured in main.ts (useStaticAssets, prefix '/uploads/'). This is the default
 * adapter and reproduces the exact filename/URL behavior the app has always had,
 * so every existing ProductImage.url already stored in the database keeps resolving.
 *
 * Local disk storage does not survive a container restart and is not shared across
 * replicas - this adapter is for local development only. Production should use
 * S3StorageAdapter (STORAGE_DRIVER=s3).
 */
@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly uploadsDir: string;

  constructor(uploadsDir: string = join(process.cwd(), 'uploads')) {
    this.uploadsDir = uploadsDir;
  }

  async save(file: Express.Multer.File, ctx: UploadRequestContext): Promise<StoredFile> {
    const filename = `${crypto.randomBytes(16).toString('hex')}${extname(file.originalname)}`;
    await fs.mkdir(this.uploadsDir, { recursive: true });
    await fs.writeFile(join(this.uploadsDir, filename), file.buffer);

    return {
      url: `${ctx.protocol}://${ctx.host}/uploads/${filename}`,
      key: filename,
    };
  }
}
