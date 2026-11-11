import { describe, expect, it } from 'vitest';
import { daysAgo, formatAgo, formatBytes, formatDayLabel, formatListTime } from './time';
import { highlight } from '../features/search/highlight';

const now = new Date(2026, 10, 11, 15, 0); // 11 Nov 2026, 15:00

describe('time helpers', () => {
  it('counts calendar days', () => {
    expect(daysAgo(new Date(2026, 10, 11, 0, 1), now)).toBe(0);
    expect(daysAgo(new Date(2026, 10, 10, 23, 59), now)).toBe(1);
  });

  it('formats list times', () => {
    expect(formatListTime(new Date(2026, 10, 10, 9), now)).toBe('Yesterday');
    expect(formatListTime(undefined, now)).toBe('');
    expect(formatListTime('garbage', now)).toBe('');
  });

  it('labels days', () => {
    expect(formatDayLabel(new Date(2026, 10, 11, 1), now)).toBe('Today');
    expect(formatDayLabel(new Date(2026, 10, 10, 1), now)).toBe('Yesterday');
  });

  it('formats relative and sizes', () => {
    expect(formatAgo(new Date(now.getTime() - 5 * 60_000), now.getTime())).toBe('5m ago');
    expect(formatAgo(null)).toBe('never');
    expect(formatBytes(2048)).toBe('2 KB');
  });
});

describe('highlight', () => {
  it('marks matches case-insensitively', () => {
    expect(highlight('Your OTP is 1234', 'otp')).toEqual([
      { text: 'Your ', match: false },
      { text: 'OTP', match: true },
      { text: ' is 1234', match: false },
    ]);
  });

  it('trims long text around the first match', () => {
    const text = 'a '.repeat(300) + 'invoice attached';
    const segs = highlight(text, 'invoice');
    expect(segs[0].text.startsWith('…')).toBe(true);
    expect(segs.some((s) => s.match && s.text === 'invoice')).toBe(true);
  });
});
