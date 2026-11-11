import { BadRequestException } from '@nestjs/common';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Maps each allowed MIME type to the one extension we'll ever write to storage.
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/**
 * Returns the extension storage adapters must use for a saved file, derived from the
 * already-validated MIME type - never from the client-supplied original filename.
 * The filename is fully attacker-controlled (a request can declare mimetype
 * "image/jpeg" while naming the file "payload.html"), so deriving the on-disk/S3-key
 * extension from it would let an attacker choose the extension a "validated" image
 * upload is served with - e.g. storing a same-origin .html/.svg file that executes
 * script when opened directly, bypassing imageFileFilter entirely.
 */
export function safeExtensionFor(mimetype: string): string {
  return MIME_EXTENSIONS[mimetype] ?? '.bin';
}

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
