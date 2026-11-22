import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBannerDto, UpdateBannerDto } from './banner.dto';

const VALID = { placement: 'hero', imageUrl: 'https://cdn.example.com/a.jpg', title: 'Winter Collection' };

async function errorsFor(overrides: Record<string, unknown>) {
  const dto = plainToInstance(CreateBannerDto, { ...VALID, ...overrides });
  return validate(dto);
}

describe('CreateBannerDto.ctaUrl - rejects unsafe link schemes (XSS hardening)', () => {
  it('accepts a fully valid payload with zero errors', async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });

  it('accepts a relative path', async () => {
    const errors = await errorsFor({ ctaUrl: '/shop?category=hoodies' });
    expect(errors.some((e) => e.property === 'ctaUrl')).toBe(false);
  });

  it('accepts an absolute http(s) URL', async () => {
    const errors = await errorsFor({ ctaUrl: 'https://premalkaizen.in/shop' });
    expect(errors.some((e) => e.property === 'ctaUrl')).toBe(false);
  });

  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'ftp://evil.example.com'])(
    'rejects an unsafe scheme: %s',
    async (ctaUrl) => {
      const errors = await errorsFor({ ctaUrl });
      expect(errors.some((e) => e.property === 'ctaUrl')).toBe(true);
    },
  );

  it('is optional - omitting it entirely is valid', async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });
});

describe('CreateBannerDto.textColor / fontStyle', () => {
  it('accepts a valid hex color and known font style', async () => {
    const errors = await errorsFor({ textColor: '#FFFFFF', fontStyle: 'sans' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-hex textColor', async () => {
    const errors = await errorsFor({ textColor: 'white' });
    expect(errors.some((e) => e.property === 'textColor')).toBe(true);
  });

  it('rejects an unknown fontStyle', async () => {
    const errors = await errorsFor({ fontStyle: 'comic-sans' });
    expect(errors.some((e) => e.property === 'fontStyle')).toBe(true);
  });
});

describe('UpdateBannerDto.ctaUrl - same safe-URL rule applies on update', () => {
  it('rejects an unsafe scheme', async () => {
    const dto = plainToInstance(UpdateBannerDto, { ctaUrl: 'javascript:alert(1)' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'ctaUrl')).toBe(true);
  });

  it('accepts a relative path', async () => {
    const dto = plainToInstance(UpdateBannerDto, { ctaUrl: '/shop' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'ctaUrl')).toBe(false);
  });
});
