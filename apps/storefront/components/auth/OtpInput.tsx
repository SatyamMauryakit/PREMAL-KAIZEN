'use client';

import { useRef, useEffect, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Bump this (e.g. an incrementing counter) to force-clear and refocus the first box, such as after a failed attempt. */
  clearSignal?: number;
  autoFocus?: boolean;
}

/**
 * A 6-digit OTP entry control: one box per digit, auto-advances focus as each
 * digit is typed, supports Backspace-to-previous and pasting a full code into
 * any box, and exposes the same digits-only string every OTP screen in the
 * app already expects from a plain text input - so call sites only need to
 * swap the old single `<input>` for this component.
 */
export default function OtpInput({ length = 6, value, onChange, disabled, clearSignal, autoFocus }: OtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  useEffect(() => {
    if (autoFocus) inputRefs.current[0]?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (clearSignal !== undefined) {
      inputRefs.current[0]?.focus();
    }
  }, [clearSignal]);

  const setDigitAt = (index: number, char: string) => {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join('').replace(/\s/g, ''));
  };

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setDigitAt(index, '');
      return;
    }
    // Handles both a single keystroke and a multi-digit value landing in one
    // box (some mobile keyboards/autofill do this instead of firing onPaste).
    const chars = raw.split('');
    let cursor = index;
    for (const char of chars) {
      if (cursor >= length) break;
      setDigitAt(cursor, char);
      cursor += 1;
    }
    const nextIndex = Math.min(index + chars.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index]?.trim()) {
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        setDigitAt(index - 1, '');
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const nextIndex = Math.min(pasted.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3" role="group" aria-label="6-digit verification code">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digits[index]?.trim() || ''}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${length}`}
          className="w-10 h-12 sm:w-12 sm:h-14 border-2 border-gray-300 rounded-lg text-center text-2xl font-mono focus:outline-none focus:border-black disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        />
      ))}
    </div>
  );
}
