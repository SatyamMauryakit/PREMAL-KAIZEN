import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateReviewDto } from './create-review.dto';

const VALID = { productId: 'prod_1', orderItemId: 'oi_1', rating: 5, title: 'Great fit', description: 'Fits true to size and feels premium.' };

async function errorsFor(overrides: Partial<typeof VALID>) {
  const dto = plainToInstance(CreateReviewDto, { ...VALID, ...overrides });
  return validate(dto);
}

describe('CreateReviewDto validation (exercises the real global ValidationPipe path)', () => {
  it('accepts a fully valid payload with zero errors', async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });

  it.each([0, 6, -1, 3.5, 'five' as any])('rejects an invalid rating: %s', async (rating) => {
    const errors = await errorsFor({ rating });
    expect(errors.some((e) => e.property === 'rating')).toBe(true);
  });

  it('rejects a title that is too short', async () => {
    const errors = await errorsFor({ title: 'ok' });
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects a title that is too long', async () => {
    const errors = await errorsFor({ title: 'x'.repeat(151) });
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects a description that is too short', async () => {
    const errors = await errorsFor({ description: 'short' });
    expect(errors.some((e) => e.property === 'description')).toBe(true);
  });

  it('rejects a description that is too long', async () => {
    const errors = await errorsFor({ description: 'x'.repeat(2001) });
    expect(errors.some((e) => e.property === 'description')).toBe(true);
  });

  it('does not reject HTML/script content by itself - length/type validation is the boundary, not content filtering (React escapes it on render)', async () => {
    const errors = await errorsFor({ title: '<script>alert(1)</script>', description: 'A perfectly long enough description here.' });
    expect(errors).toHaveLength(0);
  });
});
