import { describe, it, expect } from 'vitest';
import { dateKeyInTz, dayRangeInTz, streakDateFor, shiftDateKey, isValidTimeZone, getRequestTimeZone, startOfDayKeyInTz } from './dates';

describe('dates', () => {
  it('uses the local calendar day, not UTC', () => {
    // 20:00 UTC on Nov 3 is 01:30 on Nov 4 in India and 15:00 on Nov 3 in New York
    const t = new Date('2026-11-03T20:00:00Z');
    expect(dateKeyInTz(t, 'Asia/Kolkata')).toBe('2026-11-04');
    expect(dateKeyInTz(t, 'America/New_York')).toBe('2026-11-03');
    expect(dateKeyInTz(t, 'UTC')).toBe('2026-11-03');
  });

  it('computes local day boundaries as UTC instants', () => {
    const { start, end } = dayRangeInTz(new Date('2026-11-04T06:00:00Z'), 'Asia/Kolkata');
    expect(start.toISOString()).toBe('2026-11-03T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-11-04T18:29:59.999Z');
  });

  it('handles a DST change day', () => {
    // US DST ended on 2026-11-01: that day is 25 hours long in New York
    const { start, end } = dayRangeInTz(new Date('2026-11-01T15:00:00Z'), 'America/New_York');
    expect(start.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-02T04:59:59.999Z');
  });

  it('stores streak dates at noon UTC of the local day', () => {
    expect(streakDateFor(new Date('2026-11-03T20:00:00Z'), 'Asia/Kolkata').toISOString()).toBe(
      '2026-11-04T12:00:00.000Z'
    );
  });

  it('shifts date keys across month boundaries', () => {
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('validates timezones', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });

  it('falls back to UTC for a malformed tz cookie instead of throwing', () => {
    const req = (value: string) => ({ cookies: { get: () => ({ value }) } });
    expect(getRequestTimeZone(req('%E0'))).toBe('UTC');
    expect(getRequestTimeZone(req('Asia%2FKolkata'))).toBe('Asia/Kolkata');
  });

  it('finds the start of a given calendar day in a timezone', () => {
    expect(startOfDayKeyInTz('2026-11-10', 'Asia/Kolkata').toISOString()).toBe('2026-11-09T18:30:00.000Z');
    expect(startOfDayKeyInTz('2026-11-10', 'America/New_York').toISOString()).toBe('2026-11-10T05:00:00.000Z');
    expect(startOfDayKeyInTz('2026-11-10', 'UTC').toISOString()).toBe('2026-11-10T00:00:00.000Z');
  });
});
