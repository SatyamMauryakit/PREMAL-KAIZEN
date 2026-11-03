import { BadRequestException } from '@nestjs/common';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Multer fileFilter: rejects anything outside the allowed image MIME types.
 * Must reject with a BadRequestException (not a plain Error) so a rejected upload
 * surfaces as HTTP 400, not an unhandled-error 500.
 */
export function imageFileFilter(
  _req: unknown,
  file: { mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(new BadRequestException('Only JPEG, PNG, WEBP, and GIF images are allowed'), false);
    return;
  }
  callback(null, true);
}
