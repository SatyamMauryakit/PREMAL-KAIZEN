import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, imageFileFilter, safeExtensionFor } from './upload-validation';

describe('upload-validation', () => {
  it('declares the expected allowed image types and a 5MB size limit', () => {
    expect(ALLOWED_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });

  describe('imageFileFilter', () => {
    it.each(ALLOWED_MIME_TYPES)('accepts %s', (mimetype) => {
      const callback = vi.fn();
      imageFileFilter({}, { mimetype }, callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('rejects a disallowed MIME type with a BadRequestException (not a plain Error)', () => {
      const callback = vi.fn();
      imageFileFilter({}, { mimetype: 'application/pdf' }, callback);

      expect(callback).toHaveBeenCalledTimes(1);
      const [error, accepted] = callback.mock.calls[0];
      expect(error).toBeInstanceOf(BadRequestException);
      expect(accepted).toBe(false);
    });

    it('rejects a spoofed "image/svg+xml" mimetype (not in the allow-list)', () => {
      const callback = vi.fn();
      imageFileFilter({}, { mimetype: 'image/svg+xml' }, callback);
      expect(callback).toHaveBeenCalledWith(expect.any(BadRequestException), false);
    });
  });

  describe('safeExtensionFor', () => {
    it.each([
      ['image/jpeg', '.jpg'],
      ['image/png', '.png'],
      ['image/webp', '.webp'],
      ['image/gif', '.gif'],
    ])('maps %s to %s', (mimetype, expected) => {
      expect(safeExtensionFor(mimetype)).toBe(expected);
    });

    it('falls back to a safe default for an unrecognized MIME type', () => {
      // Unreachable via imageFileFilter in production (it rejects first), but storage
      // adapters must never produce an attacker-chosen extension even if called directly.
      expect(safeExtensionFor('application/x-msdownload')).toBe('.bin');
    });
  });
});
