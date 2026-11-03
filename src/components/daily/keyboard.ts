// Shortcut guards shared by the daily table and focus mode.

type KeyLike = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: EventTarget | null;
};

/** True when the key press is going into a text field, so shortcuts must stay out of the way. */
export function isTypingTarget(target: EventTarget | null | undefined): boolean {
  const el = target as (HTMLElement & { isContentEditable?: boolean }) | null | undefined;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
}

export function hasModifier(e: KeyLike): boolean {
  return !!(e.ctrlKey || e.metaKey || e.altKey);
}

/** Ctrl+Z / Cmd+Z (without Shift, which is redo). */
export function isUndoChord(e: KeyLike & { shiftKey?: boolean }): boolean {
  return !!(e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'z';
}

/** A plain single-key shortcut: no modifiers and not typing. */
export function isPlainShortcut(e: KeyLike): boolean {
  return !hasModifier(e) && !isTypingTarget(e.target);
}

export const RATING_KEYS: Record<string, 'CLEAN' | 'SHAKY' | 'STRUGGLED'> = {
  '1': 'CLEAN',
  '2': 'SHAKY',
  '3': 'STRUGGLED',
};
