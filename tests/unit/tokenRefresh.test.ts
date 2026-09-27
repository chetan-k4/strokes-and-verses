import { describe, it, expect } from 'vitest';
import { shouldRefreshToken } from '../../scripts/instagram-sync/tokenRefresh';

describe('shouldRefreshToken', () => {
  const now = new Date('2026-09-28T08:00:00+05:30');

  it('refreshes when there is no recorded refresh yet', () => {
    expect(shouldRefreshToken(null, now)).toBe(true);
  });

  it('does not refresh again if it happened less than 7 days ago', () => {
    expect(shouldRefreshToken('2026-09-22T08:00:00+05:30', now)).toBe(false);
  });

  it('refreshes again once 7 or more days have passed', () => {
    expect(shouldRefreshToken('2026-09-21T08:00:00+05:30', now)).toBe(true);
  });

  it('refreshes right at the 7-day boundary', () => {
    expect(shouldRefreshToken('2026-09-21T08:00:00+05:30', new Date('2026-09-28T08:00:00.000+05:30'))).toBe(true);
  });
});
