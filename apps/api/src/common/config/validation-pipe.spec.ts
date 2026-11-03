import { describe, it, expect } from 'vitest';
import { ValidationPipe } from '@nestjs/common';

/**
 * Confirms, empirically rather than by reasoning alone, that the global
 * ValidationPipe wired in main.ts is a no-op against every existing route in this
 * codebase - none of them use a real class-validator-decorated DTO class (every
 * @Body() is typed `any` or a plain inline object type, which TypeScript erases at
 * runtime). NestJS's ValidationPipe skips validation/transformation entirely for
 * metatypes it doesn't recognize as a custom class (String/Boolean/Number/Array/
 * Object), which is exactly what every current endpoint's param reflects as.
 */
describe('global ValidationPipe against this codebase (no DTO classes exist yet)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false });

  it('passes an arbitrary plain object through completely unchanged for an untyped (Object) body param', async () => {
    const body = { email: 'a@b.com', password: 'secret', extraField: 'should NOT be stripped', nested: { x: 1 } };

    const result = await pipe.transform(body, { type: 'body', metatype: Object, data: '' });

    expect(result).toEqual(body);
  });

  it('passes an object through unchanged when no metatype is known at all (matches `any`-typed @Body())', async () => {
    const body = { anything: 'goes', couponCode: 'SAVE10' };

    const result = await pipe.transform(body, { type: 'body', metatype: undefined, data: '' });

    expect(result).toEqual(body);
  });
});
