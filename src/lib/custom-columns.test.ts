import { describe, it, expect } from 'vitest';
import {
  distinctValues,
  formatCustomValue,
  isChecked,
  isColumnType,
  normalizeOptions,
  parseCustomValue,
  parseDateValue,
  parseUrlValue,
  readCustomFields,
  removeFieldKey,
  renameFieldKey,
  reorderIds,
  toCustomColumn,
  validateColumnName,
} from './custom-columns';

const col = (type: any, options: string[] = []) => ({ type, options });

describe('custom-columns', () => {
  describe('validateColumnName', () => {
    const existing = [{ id: 'a', name: 'Language' }, { id: 'b', name: 'Company' }];

    it('trims and collapses whitespace', () => {
      expect(validateColumnName('  My   Col ', existing)).toEqual({ ok: true, value: 'My Col' });
    });
    it('rejects empty, non-string and too long names', () => {
      expect(validateColumnName('   ').ok).toBe(false);
      expect(validateColumnName(42).ok).toBe(false);
      expect(validateColumnName('x'.repeat(41)).ok).toBe(false);
    });
    it('is case-insensitively unique, ignoring itself', () => {
      const r = validateColumnName('language', existing);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('already exists');
      expect(validateColumnName('LANGUAGE', existing, 'a')).toEqual({ ok: true, value: 'LANGUAGE' });
    });
  });

  describe('normalizeOptions', () => {
    it('accepts arrays and comma/newline strings, dedupes case-insensitively', () => {
      expect(normalizeOptions(['Todo', ' todo ', 'Done', ''])).toEqual({ ok: true, value: ['Todo', 'Done'] });
      expect(normalizeOptions('a, b\nc')).toEqual({ ok: true, value: ['a', 'b', 'c'] });
      expect(normalizeOptions(null)).toEqual({ ok: true, value: [] });
    });
    it('rejects bad shapes and limits', () => {
      expect(normalizeOptions({}).ok).toBe(false);
      expect(normalizeOptions(['x'.repeat(41)]).ok).toBe(false);
      expect(normalizeOptions(Array.from({ length: 51 }, (_, i) => `o${i}`)).ok).toBe(false);
    });
  });

  describe('parseCustomValue', () => {
    it('text trims and caps length', () => {
      expect(parseCustomValue(col('text'), '  hi ')).toEqual({ ok: true, value: 'hi' });
      expect(parseCustomValue(col('text'), 'x'.repeat(1001)).ok).toBe(false);
      expect(parseCustomValue(col('text'), null)).toEqual({ ok: true, value: '' });
    });
    it('select matches options case-insensitively and returns canonical spelling', () => {
      const c = col('select', ['Todo', 'Done']);
      expect(parseCustomValue(c, 'done')).toEqual({ ok: true, value: 'Done' });
      expect(parseCustomValue(c, '')).toEqual({ ok: true, value: '' });
      expect(parseCustomValue(c, 'Later').ok).toBe(false);
    });
    it('checkbox maps truthy/falsy words', () => {
      expect(parseCustomValue(col('checkbox'), 'Yes')).toEqual({ ok: true, value: 'true' });
      expect(parseCustomValue(col('checkbox'), true)).toEqual({ ok: true, value: 'true' });
      expect(parseCustomValue(col('checkbox'), 'no')).toEqual({ ok: true, value: '' });
      expect(parseCustomValue(col('checkbox'), false)).toEqual({ ok: true, value: '' });
      expect(parseCustomValue(col('checkbox'), 'maybe').ok).toBe(false);
    });
    it('date normalizes to YYYY-MM-DD', () => {
      expect(parseCustomValue(col('date'), '2025-1-5')).toEqual({ ok: true, value: '2025-01-05' });
      expect(parseCustomValue(col('date'), '31/01/2025')).toEqual({ ok: true, value: '2025-01-31' });
      expect(parseCustomValue(col('date'), '2025-02-30').ok).toBe(false);
      expect(parseCustomValue(col('date'), 'soon').ok).toBe(false);
    });
    it('url requires http(s) and adds https:// to bare domains', () => {
      expect(parseCustomValue(col('url'), 'example.com/a')).toEqual({ ok: true, value: 'https://example.com/a' });
      expect(parseCustomValue(col('url'), 'javascript:alert(1)').ok).toBe(false);
      expect(parseCustomValue(col('url'), 'not a url').ok).toBe(false);
    });
  });

  it('parseDateValue and parseUrlValue edge cases', () => {
    expect(parseDateValue('2024-02-29')).toBe('2024-02-29');
    expect(parseDateValue('2023-02-29')).toBeNull();
    expect(parseDateValue('2025-03-04T10:00:00Z')).toBe('2025-03-04');
    expect(parseUrlValue('ftp://x.com')).toBeNull();
    expect(parseUrlValue('')).toBeNull();
  });

  it('formatCustomValue renders per type', () => {
    expect(formatCustomValue({ type: 'date' }, '2025-01-05')).toBe('Jan 5, 2025');
    expect(formatCustomValue({ type: 'date' }, 'garbage')).toBe('garbage');
    expect(formatCustomValue({ type: 'checkbox' }, 'true')).toBe('Yes');
    expect(formatCustomValue({ type: 'checkbox' }, '')).toBe('');
    expect(formatCustomValue({ type: 'url' }, 'https://leetcode.com/problems/x/')).toBe('leetcode.com/problems/x');
    expect(formatCustomValue({ type: 'text' }, undefined)).toBe('');
    expect(isChecked('YES')).toBe(true);
  });

  it('toCustomColumn falls back to text for unknown types and bad options', () => {
    expect(toCustomColumn({ id: '1', name: 'A', type: 'weird', options: 5, order: 2 })).toEqual({
      id: '1', name: 'A', type: 'text', options: [], order: 2,
    });
    expect(isColumnType('select')).toBe(true);
    expect(isColumnType('number')).toBe(false);
  });

  it('readCustomFields, renameFieldKey, removeFieldKey', () => {
    expect(readCustomFields({ a: 'x', b: 1, c: null })).toEqual({ a: 'x', b: '1' });
    expect(readCustomFields([1, 2])).toEqual({});
    expect(renameFieldKey({ a: '1', b: '2' }, 'a', 'z')).toEqual({ z: '1', b: '2' });
    expect(renameFieldKey({ a: '1', z: 'old' }, 'a', 'z')).toEqual({ z: '1' });
    expect(renameFieldKey({ b: '2' }, 'a', 'z')).toBeNull();
    expect(removeFieldKey({ a: '1', b: '2' }, 'a')).toEqual({ b: '2' });
    expect(removeFieldKey({ b: '2' }, 'a')).toBeNull();
  });

  it('distinctValues and reorderIds', () => {
    expect(distinctValues(['A', 'a', '', ' B '])).toEqual(['A', 'B']);
    expect(reorderIds(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(reorderIds(['a', 'b', 'c'], 'a', 99)).toEqual(['b', 'c', 'a']);
    expect(reorderIds(['a', 'b'], 'x', 0)).toEqual(['a', 'b']);
  });
});
