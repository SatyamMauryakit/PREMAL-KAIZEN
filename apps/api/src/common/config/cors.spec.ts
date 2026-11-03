import { describe, it, expect, vi } from 'vitest';
import { getAllowedOrigins, createCorsOriginValidator } from './cors';

describe('getAllowedOrigins', () => {
  it('defaults to the local storefront and admin dev servers when unset', () => {
    expect(getAllowedOrigins({})).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  it('parses a comma-separated CORS_ALLOWED_ORIGINS value, trimming whitespace', () => {
    expect(
      getAllowedOrigins({ CORS_ALLOWED_ORIGINS: ' https://premalkaizen.com, https://admin.premalkaizen.com ' }),
    ).toEqual(['https://premalkaizen.com', 'https://admin.premalkaizen.com']);
  });

  it('falls back to defaults for an empty/whitespace-only value', () => {
    expect(getAllowedOrigins({ CORS_ALLOWED_ORIGINS: '   ' })).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
  });
});

describe('createCorsOriginValidator', () => {
  const validate = createCorsOriginValidator(['https://premalkaizen.com']);

  it('allows a request with no Origin header at all (server-to-server, e.g. the Razorpay webhook)', () => {
    const callback = vi.fn();
    validate(undefined, callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('allows an exact match against the allowlist', () => {
    const callback = vi.fn();
    validate('https://premalkaizen.com', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('rejects an origin not on the allowlist', () => {
    const callback = vi.fn();
    validate('https://evil.example.com', callback);
    expect(callback).toHaveBeenCalledTimes(1);
    const [error, allowed] = callback.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(allowed).toBe(false);
  });

  it('rejects a near-miss (subdomain/protocol/port difference is not a match)', () => {
    const callback = vi.fn();
    validate('http://premalkaizen.com', callback); // http, not https
    expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
  });
});
