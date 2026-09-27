import { describe, it, expect } from 'vitest';
import { istParts, splitEvents, formatDateStamp, formatLongDate, formatShortDate, formatTime, formatTimeRange, resolveNow } from '../../src/lib/eventDates';

describe('istParts', () => {
  it('reads wall-clock parts in IST from any offset', () => {
    expect(istParts('2026-09-19T12:00:00Z')).toEqual({ year: 2026, month: 9, day: 19, hour: 17, minute: 30, weekday: 'Sat' });
  });
});

describe('formatting', () => {
  const s = '2026-09-19T17:30:00+05:30';
  it('date stamp uses Sept, not Sep', () => expect(formatDateStamp(s)).toEqual({ weekday: 'Sat', day: '19', month: 'Sept' }));
  it('pads the day in the stamp', () => expect(formatDateStamp('2026-09-06T15:30:00+05:30').day).toBe('06'));
  it('long date', () => expect(formatLongDate(s)).toBe('Saturday 19 September'));
  it('short date', () => expect(formatShortDate(s)).toBe('Sat 19 Sept'));
  it('time', () => {
    expect(formatTime(s)).toBe('5:30 pm');
    expect(formatTime('2026-09-19T17:00:00+05:30')).toBe('5 pm');
    expect(formatTime('2026-09-19T12:15:00+05:30')).toBe('12:15 pm');
    expect(formatTime('2026-09-19T00:15:00+05:30')).toBe('12:15 am');
  });
  it('time range shares the meridiem when equal', () => {
    expect(formatTimeRange(s, '2026-09-19T19:30:00+05:30')).toBe('5:30 to 7:30 pm');
    expect(formatTimeRange('2026-09-19T11:30:00+05:30', '2026-09-19T13:30:00+05:30')).toBe('11:30 am to 1:30 pm');
    expect(formatTimeRange(s, null)).toBe('5:30 pm');
  });
});

describe('splitEvents', () => {
  const a = { id: 'a', start: '2026-09-06T15:30:00+05:30', end: '2026-09-06T17:30:00+05:30' };
  const b = { id: 'b', start: '2026-09-19T17:30:00+05:30', end: '2026-09-19T19:30:00+05:30' };
  const c = { id: 'c', start: '2026-09-20T15:30:00+05:30', end: null };
  it('splits and sorts', () => {
    const { upcoming, past } = splitEvents([c, a, b], new Date('2026-09-15T10:00:00+05:30'));
    expect(upcoming.map((e) => e.id)).toEqual(['b', 'c']);
    expect(past.map((e) => e.id)).toEqual(['a']);
  });
  it('keeps an event upcoming until it ends', () => {
    const { upcoming } = splitEvents([b], new Date('2026-09-19T18:00:00+05:30'));
    expect(upcoming).toHaveLength(1);
  });
});

describe('resolveNow', () => {
  it('uses the override when given', () => expect(resolveNow('2026-09-15T10:00:00+05:30').toISOString()).toBe('2026-09-15T04:30:00.000Z'));
  it('falls back to the real clock', () => expect(Math.abs(resolveNow().getTime() - Date.now())).toBeLessThan(1000));
});
