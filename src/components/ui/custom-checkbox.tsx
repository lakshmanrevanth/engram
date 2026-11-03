'use client';

import { useState } from 'react';

type CustomCheckboxProps = {
  checked: boolean;
  onChange: (e: React.MouseEvent) => void;
  title?: string;
  /** Accessible name; falls back to `title`. */
  ariaLabel?: string;
  /** id of an element that labels this checkbox (e.g. a sibling <span>). */
  ariaLabelledBy?: string;
  disabled?: boolean;
  opacity?: number;
  size?: number;
};

export function CustomCheckbox({
  checked,
  onChange,
  title,
  ariaLabel,
  ariaLabelledBy,
  disabled = false,
  opacity = 1,
  size = 15,
}: CustomCheckboxProps) {
  const [hovered, setHovered] = useState(false);
  // Rows render the checkbox at opacity 0 until hover; keep it visible while
  // it has keyboard focus so the focus ring isn't drawn around nothing.
  const [focused, setFocused] = useState(false);

  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabelledBy ? undefined : ariaLabel ?? title}
      aria-labelledby={ariaLabelledBy}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onChange(e);
      }}
      onKeyDown={(e) => {
        // Space is the standard checkbox key; Enter kept for compatibility.
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          if (disabled) return;
          onChange(e as unknown as React.MouseEvent);
        }
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        border: checked
          ? '1px solid var(--checkbox-checked-border)'
          : hovered
          ? '1px solid var(--checkbox-hover-border)'
          : '1px solid var(--checkbox-border)',
        background: checked
          ? 'var(--checkbox-checked-bg)'
          : hovered
          ? 'var(--checkbox-hover-bg)'
          : 'var(--checkbox-bg)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        opacity: focused ? 1 : opacity,
        boxShadow: 'none',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {checked && (
        <svg
          width={size - 4}
          height={size - 4}
          viewBox="0 0 12 12"
          fill="none"
          stroke="var(--checkbox-check-color)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="2.5 6 5 8.5 9.5 3.5" />
        </svg>
      )}
    </div>
  );
}
