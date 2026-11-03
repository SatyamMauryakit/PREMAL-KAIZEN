import { describe, it, expect, vi } from 'vitest';

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
  PutObjectCommand: vi.fn(),
}));

import { createStorageAdapter } from './storage.provider';
import { LocalStorageAdapter } from './local-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';

describe('createStorageAdapter', () => {
  it('defaults to LocalStorageAdapter when STORAGE_DRIVER is unset', () => {
    const adapter = createStorageAdapter({});
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
  });

  it('returns LocalStorageAdapter when STORAGE_DRIVER=local is explicit', () => {
    const adapter = createStorageAdapter({ STORAGE_DRIVER: 'local' });
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
  });

  it('returns S3StorageAdapter when STORAGE_DRIVER=s3 with complete configuration', () => {
    const adapter = createStorageAdapter({
      STORAGE_DRIVER: 's3',
      S3_BUCKET: 'my-bucket',
      AWS_REGION: 'ap-south-1',
    });
    expect(adapter).toBeInstanceOf(S3StorageAdapter);
  });

  it('throws immediately (fails fast) when STORAGE_DRIVER=s3 but S3_BUCKET is missing', () => {
    expect(() => createStorageAdapter({ STORAGE_DRIVER: 's3', AWS_REGION: 'ap-south-1' })).toThrow(
      /S3_BUCKET/,
    );
  });

  it('throws when STORAGE_DRIVER=s3 but AWS_REGION/S3_REGION is missing', () => {
    expect(() => createStorageAdapter({ STORAGE_DRIVER: 's3', S3_BUCKET: 'my-bucket' })).toThrow(
      /AWS_REGION/,
    );
  });

  it('throws listing every missing field when both are absent, and never falls back to local silently', () => {
    expect(() => createStorageAdapter({ STORAGE_DRIVER: 's3' })).toThrow(/S3_BUCKET.*AWS_REGION/);
  });

  it('accepts S3_REGION as a fallback for AWS_REGION', () => {
    const adapter = createStorageAdapter({
      STORAGE_DRIVER: 's3',
      S3_BUCKET: 'my-bucket',
      S3_REGION: 'ap-south-1',
    });
    expect(adapter).toBeInstanceOf(S3StorageAdapter);
  });

  it('rejects an unrecognized STORAGE_DRIVER value', () => {
    expect(() => createStorageAdapter({ STORAGE_DRIVER: 'azure-blob' })).toThrow(/Unknown STORAGE_DRIVER/);
  });

  it('is case-insensitive for the driver name', () => {
    const adapter = createStorageAdapter({ STORAGE_DRIVER: 'LOCAL' });
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
  });
});
