import { describe, it, expect, vi, beforeEach } from 'vitest';

// The S3 client must never make a real network call in tests - mock the whole SDK.
const sendMock = vi.fn();
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

import { S3StorageAdapter } from './s3-storage.adapter';

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    originalname: 'photo.png',
    mimetype: 'image/png',
    buffer: Buffer.from('fake-bytes'),
    size: 10,
    ...overrides,
  } as Express.Multer.File;
}

describe('S3StorageAdapter', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
  });

  it('uploads via PutObjectCommand with the correct bucket, body, and content type, and never sets an ACL', async () => {
    const adapter = new S3StorageAdapter({ bucket: 'my-bucket', region: 'ap-south-1', keyPrefix: '' });
    const file = makeFile();

    await adapter.save(file, { protocol: 'https', host: 'ignored-for-s3' });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.input.Bucket).toBe('my-bucket');
    expect(command.input.Body).toBe(file.buffer);
    expect(command.input.ContentType).toBe('image/png');
    expect(command.input.ACL).toBeUndefined(); // bucket stays private; no public-read ACL is ever requested
  });

  it('generates a random key with the original extension preserved, under the configured prefix', async () => {
    const adapter = new S3StorageAdapter({ bucket: 'b', region: 'ap-south-1', keyPrefix: 'products/' });
    const result = await adapter.save(makeFile({ originalname: 'x.webp', mimetype: 'image/webp' }), {
      protocol: 'https',
      host: 'x',
    });

    expect(result.key).toMatch(/^products\/[0-9a-f]{32}\.webp$/);
  });

  it('builds a raw S3 URL when no public base URL (CDN) is configured', async () => {
    const adapter = new S3StorageAdapter({ bucket: 'my-bucket', region: 'ap-south-1', keyPrefix: '' });
    const result = await adapter.save(makeFile(), { protocol: 'https', host: 'x' });

    expect(result.url).toBe(`https://my-bucket.s3.ap-south-1.amazonaws.com/${result.key}`);
  });

  it('builds a CDN-based URL when publicBaseUrl is configured, trimming a trailing slash', async () => {
    const adapter = new S3StorageAdapter({
      bucket: 'my-bucket',
      region: 'ap-south-1',
      keyPrefix: '',
      publicBaseUrl: 'https://images.premalkaizen.com/',
    });
    const result = await adapter.save(makeFile(), { protocol: 'https', host: 'x' });

    expect(result.url).toBe(`https://images.premalkaizen.com/${result.key}`);
  });

  it('propagates an S3 failure to the caller (so the controller can surface a 500, not a false success)', async () => {
    sendMock.mockRejectedValue(new Error('Access Denied'));
    const adapter = new S3StorageAdapter({ bucket: 'my-bucket', region: 'ap-south-1', keyPrefix: '' });

    await expect(adapter.save(makeFile(), { protocol: 'https', host: 'x' })).rejects.toThrow('Access Denied');
  });
});
