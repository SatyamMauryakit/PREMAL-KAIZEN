import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { extname } from 'path';
import * as crypto from 'crypto';
import { StorageAdapter, StoredFile } from './storage-adapter.interface';

export interface S3StorageConfig {
  bucket: string;
  region: string;
  /** Optional key prefix, e.g. "products/" - keeps uploads namespaced within a shared bucket. */
  keyPrefix: string;
  /** Optional CDN/custom-domain base URL (e.g. CloudFront) used instead of the raw S3 URL. */
  publicBaseUrl?: string;
}

/**
 * S3StorageAdapter
 * Uploads to a private S3 bucket. Credentials are never read or constructed here -
 * the AWS SDK's own default provider chain resolves them (IAM role / instance profile
 * in production, or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY env vars locally). No
 * object ACL is set: the bucket is expected to stay private, with reads served through
 * a CloudFront distribution using Origin Access Control (see docs/uploads-s3.md).
 */
@Injectable()
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({ region: config.region });
  }

  async save(file: Express.Multer.File): Promise<StoredFile> {
    const key = `${this.config.keyPrefix}${crypto.randomBytes(16).toString('hex')}${extname(file.originalname)}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const base = this.config.publicBaseUrl
      ? this.config.publicBaseUrl.replace(/\/$/, '')
      : `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com`;

    return { url: `${base}/${key}`, key };
  }
}
