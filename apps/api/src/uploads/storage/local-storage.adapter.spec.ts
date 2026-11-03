import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LocalStorageAdapter } from './local-storage.adapter';

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-bytes'),
    size: 16,
    ...overrides,
  } as Express.Multer.File;
}

describe('LocalStorageAdapter', () => {
  // Uses an isolated temp directory per test run - must never write into the real
  // apps/api/uploads/ directory, which holds actual product images.
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `uploads-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('writes the file buffer to disk and returns a resolvable URL + key', async () => {
    const adapter = new LocalStorageAdapter(testDir);
    const file = makeFile();

    const result = await adapter.save(file, { protocol: 'http', host: 'localhost:3002' });

    expect(result.url).toBe(`http://localhost:3002/uploads/${result.key}`);
    expect(result.key).toMatch(/^[0-9a-f]{32}\.jpg$/);

    const written = await fs.readFile(join(testDir, result.key));
    expect(written.toString()).toBe('fake-image-bytes');
  });

  it('generates a different random key for every upload (no overwrite/collision)', async () => {
    const adapter = new LocalStorageAdapter(testDir);
    const a = await adapter.save(makeFile(), { protocol: 'http', host: 'localhost:3002' });
    const b = await adapter.save(makeFile(), { protocol: 'http', host: 'localhost:3002' });

    expect(a.key).not.toBe(b.key);
  });

  it('preserves the original file extension', async () => {
    const adapter = new LocalStorageAdapter(testDir);
    const result = await adapter.save(
      makeFile({ originalname: 'banner.webp', mimetype: 'image/webp' }),
      { protocol: 'https', host: 'cdn.example.com' },
    );

    expect(result.key.endsWith('.webp')).toBe(true);
  });

  it('creates the target directory if it does not already exist', async () => {
    const adapter = new LocalStorageAdapter(testDir);
    await expect(fs.access(testDir)).rejects.toThrow();

    await adapter.save(makeFile(), { protocol: 'http', host: 'localhost:3002' });

    await expect(fs.access(testDir)).resolves.toBeUndefined();
  });
});
