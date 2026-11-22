import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CancelOrderDto, CANCELLATION_REASONS } from './cancel-order.dto';

describe('CancelOrderDto', () => {
  it.each(CANCELLATION_REASONS)('accepts the valid reason "%s"', async (reason) => {
    const dto = plainToInstance(CancelOrderDto, { reason });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a reason outside the allowed set', async () => {
    const dto = plainToInstance(CancelOrderDto, { reason: 'just because' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('rejects a missing reason', async () => {
    const dto = plainToInstance(CancelOrderDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('accepts an optional comment under the length limit', async () => {
    const dto = plainToInstance(CancelOrderDto, { reason: 'other', comment: 'Please process quickly.' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('is valid with no comment at all', async () => {
    const dto = plainToInstance(CancelOrderDto, { reason: 'other' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a comment over 500 characters', async () => {
    const dto = plainToInstance(CancelOrderDto, { reason: 'other', comment: 'x'.repeat(501) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'comment')).toBe(true);
  });
});
