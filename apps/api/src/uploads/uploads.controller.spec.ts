import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UploadsController } from './uploads.controller';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

function makeFile(): Express.Multer.File {
  return {
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('bytes'),
    size: 5,
  } as Express.Multer.File;
}

function makeReq() {
  return { protocol: 'http', get: (h: string) => (h === 'host' ? 'localhost:3002' : undefined) };
}

describe('UploadsController', () => {
  // Confirms the same AuthGuard+AdminGuard wiring already unit-tested in admin.guard.spec.ts
  // actually protects this controller - i.e. that an unauthenticated/non-admin request is
  // rejected before uploadImage() ever runs. The guards' own pass/fail logic is covered there.
  it('is protected by AuthGuard and AdminGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, UploadsController);
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(AdminGuard);
  });

  it('rejects when no file was uploaded', async () => {
    const storage = { save: vi.fn() };
    const controller = new UploadsController(storage as any);

    await expect(controller.uploadImage(undefined as any, makeReq() as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('delegates to the injected storage adapter and returns its result in the existing response shape', async () => {
    const storage = {
      save: vi.fn().mockResolvedValue({ url: 'http://localhost:3002/uploads/abc123.jpg', key: 'abc123.jpg' }),
    };
    const controller = new UploadsController(storage as any);
    const file = makeFile();

    const result = await controller.uploadImage(file, makeReq() as any);

    expect(storage.save).toHaveBeenCalledWith(file, { protocol: 'http', host: 'localhost:3002' });
    expect(result).toEqual({
      url: 'http://localhost:3002/uploads/abc123.jpg',
      filename: 'abc123.jpg',
      size: file.size,
      mimeType: file.mimetype,
    });
  });

  it('surfaces a storage failure as a 500, not a silent success or a 400', async () => {
    const storage = { save: vi.fn().mockRejectedValue(new Error('S3 bucket unreachable')) };
    const controller = new UploadsController(storage as any);

    await expect(controller.uploadImage(makeFile(), makeReq() as any)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
