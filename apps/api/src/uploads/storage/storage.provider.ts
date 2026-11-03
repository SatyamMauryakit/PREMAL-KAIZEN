import { StorageAdapter } from './storage-adapter.interface';
import { LocalStorageAdapter } from './local-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';

/**
 * Selects the active storage backend from environment configuration.
 *
 * STORAGE_DRIVER unset or "local" -> LocalStorageAdapter (default, current behavior).
 * STORAGE_DRIVER=s3 -> S3StorageAdapter, requiring S3_BUCKET and AWS_REGION.
 *
 * A driver of "s3" with incomplete config throws immediately (at app startup, via
 * NestJS provider instantiation) rather than silently falling back to local disk -
 * in a container, local disk is ephemeral, so a silent fallback would look like a
 * working upload that quietly loses every file on the next restart.
 */
export function createStorageAdapter(env: NodeJS.ProcessEnv = process.env): StorageAdapter {
  const driver = (env.STORAGE_DRIVER || 'local').toLowerCase();

  if (driver === 'local') {
    return new LocalStorageAdapter();
  }

  if (driver === 's3') {
    const bucket = env.S3_BUCKET;
    const region = env.AWS_REGION || env.S3_REGION;
    const missing = [
      !bucket && 'S3_BUCKET',
      !region && 'AWS_REGION (or S3_REGION)',
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new Error(
        `STORAGE_DRIVER=s3 but required configuration is missing: ${missing.join(', ')}. ` +
          'Set these environment variables or switch STORAGE_DRIVER to "local".',
      );
    }

    return new S3StorageAdapter({
      bucket: bucket!,
      region: region!,
      keyPrefix: env.S3_KEY_PREFIX || '',
      publicBaseUrl: env.S3_PUBLIC_BASE_URL,
    });
  }

  throw new Error(`Unknown STORAGE_DRIVER "${driver}" - expected "local" or "s3".`);
}
