'use client';

import React, { useRef, useEffect } from 'react';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
  // id of the element that labels the whole code group
  labelledBy?: string;
  idPrefix?: string;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
  labelledBy,
  idPrefix = 'otp',
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Split value into an array of characters
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Replace the whole code (paste or one-time-code autofill).
  const fillAll = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, length);
    if (!clean) return;
    onChange(clean);
    inputRefs.current[Math.min(clean.length, length - 1)]?.focus();
    if (clean.length === length && onComplete) onComplete(clean);
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) return;

    // Autofill puts the whole code into the first box (it allows `length` chars).
    if (index === 0 && raw.replace(/\D/g, '').length >= length) {
      fillAll(raw);
      return;
    }

    // Take the last character entered in this box
    const lastChar = raw.slice(-1);
    if (!/^\d$/.test(lastChar)) return;

    const newDigits = [...digits];
    newDigits[index] = lastChar;
    const nextVal = newDigits.join('');
    onChange(nextVal);

    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (nextVal.length === length && onComplete) {
      onComplete(nextVal);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newDigits = [...digits];
      if (newDigits[index]) {
        newDigits[index] = '';
        onChange(newDigits.join(''));
      } else if (index > 0) {
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fillAll(e.clipboardData.getData('text/plain').trim());
  };

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : `${length}-digit code`}
      style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '16px 0',
      }}
    >
      {Array.from({ length }).map((_, index) => {
        const isFilled = !!digits[index];
        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            id={`${idPrefix}-${index}`}
            name={index === 0 ? `${idPrefix}-code` : undefined}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${index + 1} of ${length}`}
            aria-invalid={error || undefined}
            maxLength={index === 0 ? length : 1}
            value={digits[index]}
            disabled={disabled}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            style={{
              width: '46px',
              height: '52px',
              background: 'var(--otp-bg)',
              border: error
                ? '1px solid #f87171'
                : isFilled
                ? '1px solid var(--otp-border-filled)'
                : '1px solid var(--otp-border-unfilled)',
              borderRadius: '8px',
              color: 'var(--text-white)',
              fontSize: '22px',
              fontFamily: 'var(--font-geist-mono), monospace',
              fontWeight: 600,
              textAlign: 'center',
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxShadow: isFilled ? '0 0 0 1px var(--otp-fill-ring)' : 'none',
              cursor: disabled ? 'not-allowed' : 'text',
              opacity: disabled ? 0.6 : 1,
            }}
            onFocusCapture={(e) => {
              if (!error) {
                e.currentTarget.style.borderColor = 'var(--otp-focus-border)';
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--otp-focus-ring)';
              }
            }}
            onBlurCapture={(e) => {
              if (!error) {
                e.currentTarget.style.borderColor = isFilled ? 'var(--otp-border-filled)' : 'var(--otp-border-unfilled)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          />
        );
      })}
    </div>
  );
}
