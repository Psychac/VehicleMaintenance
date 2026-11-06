import { describe, expect, it } from 'vitest';
import { daysFromToday, fmtRelDate, fmtShortDate } from './format';

const now = new Date(2026, 10, 6); // 6 Nov 2026

describe('fmtRelDate', () => {
  it('uses words for today, yesterday and tomorrow', () => {
    expect(fmtRelDate('2026-11-06', now)).toBe('Today');
    expect(fmtRelDate('2026-11-05', now)).toBe('Yesterday');
    expect(fmtRelDate('2026-11-07', now)).toBe('Tomorrow');
  });
  it('counts days up to a week, then switches to an absolute date', () => {
    expect(fmtRelDate('2026-11-03', now)).toBe('3 days ago');
    expect(fmtRelDate('2026-10-30', now)).toBe('7 days ago');
    expect(fmtRelDate('2026-10-29', now)).toBe(fmtShortDate('2026-10-29', now));
  });
  it('handles blanks', () => {
    expect(fmtRelDate(null, now)).toBe('—');
  });
});

describe('fmtShortDate', () => {
  it('drops the year only for the current year', () => {
    expect(fmtShortDate('2026-12-12', now)).not.toMatch(/2026/);
    expect(fmtShortDate('2024-12-12', now)).toMatch(/2024/);
  });
});

describe('daysFromToday', () => {
  it('is DST-safe and signed', () => {
    expect(daysFromToday('2026-11-09', now)).toBe(3);
    expect(daysFromToday('2026-11-01', now)).toBe(-5);
    expect(daysFromToday('2026-03-30', new Date(2026, 2, 28))).toBe(2);
  });
});
