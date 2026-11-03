import { describe, it, expect } from 'vitest';
import { isValidIndianMobile, isValidIndianPincode } from './india';

describe('isValidIndianMobile', () => {
  // Regression coverage for a real bug found and fixed this session: the validator
  // used to strip a leading "91" from ANY number starting with those digits, even a
  // bare 10-digit number that merely happens to start with 91 (e.g. 9123456780),
  // which left only 8 digits and wrongly rejected a genuinely valid number.
  it('accepts a bare 10-digit number that happens to start with 91', () => {
    expect(isValidIndianMobile('9123456780')).toBe(true);
  });

  it('accepts a normal 10-digit number', () => {
    expect(isValidIndianMobile('9876543210')).toBe(true);
  });

  it('accepts the same number with an explicit +91 country code', () => {
    expect(isValidIndianMobile('+919123456780')).toBe(true);
  });

  it('accepts a 12-digit number with an unprefixed 91 country code', () => {
    expect(isValidIndianMobile('919876543210')).toBe(true);
  });

  it('accepts a number with spaces/dashes', () => {
    expect(isValidIndianMobile('98765 43210')).toBe(true);
    expect(isValidIndianMobile('98765-43210')).toBe(true);
  });

  it('rejects a number starting with 0-5 (not a valid Indian mobile prefix)', () => {
    expect(isValidIndianMobile('5876543210')).toBe(false);
    expect(isValidIndianMobile('1234567890')).toBe(false);
  });

  it('rejects too few or too many digits', () => {
    expect(isValidIndianMobile('987654321')).toBe(false); // 9 digits
    expect(isValidIndianMobile('98765432100')).toBe(false); // 11 digits, no country code
  });
});

describe('isValidIndianPincode', () => {
  it('accepts a valid 6-digit PIN code', () => {
    expect(isValidIndianPincode('411001')).toBe(true);
  });

  it('rejects a PIN code starting with 0 (no Indian PIN starts with 0)', () => {
    expect(isValidIndianPincode('011001')).toBe(false);
  });

  it('rejects the wrong number of digits', () => {
    expect(isValidIndianPincode('4110')).toBe(false);
    expect(isValidIndianPincode('41100111')).toBe(false);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(isValidIndianPincode('  411001  ')).toBe(true);
  });
});
