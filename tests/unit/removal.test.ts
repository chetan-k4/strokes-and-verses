import { describe, it, expect } from 'vitest';
import { findRemovedEvents } from '../../scripts/instagram-sync/removal';

const mk = (id: string, start: string, sources: [string, string][]) => ({
  id, title: 't', artForm: 'a', start, end: null, price: null, includes: [], venue: 'v', description: '', image: null,
  sources: sources.map(([postId, postedAt]) => ({ postId, permalink: 'https://www.instagram.com/', postedAt })),
});
const now = new Date('2026-09-15T10:00:00+05:30');
const fetched = [{ id: 'p3', timestamp: '2026-09-14T10:00:00+05:30' }, { id: 'p1', timestamp: '2026-09-01T10:00:00+05:30' }];

describe('findRemovedEvents', () => {
  it('removes an upcoming event whose only post vanished inside the fetched window', () => {
    expect(findRemovedEvents([mk('e', '2026-09-20T10:00:00+05:30', [['p2', '2026-09-10T10:00:00+05:30']])], fetched, now)).toEqual(['e']);
  });
  it('keeps events whose post is older than the window', () => {
    expect(findRemovedEvents([mk('e', '2026-09-20T10:00:00+05:30', [['p0', '2026-08-01T10:00:00+05:30']])], fetched, now)).toEqual([]);
  });
  it('keeps events with at least one surviving post', () => {
    expect(findRemovedEvents([mk('e', '2026-09-20T10:00:00+05:30', [['p2', '2026-09-10T10:00:00+05:30'], ['p3', '2026-09-14T10:00:00+05:30']])], fetched, now)).toEqual([]);
  });
  it('never removes past events', () => {
    expect(findRemovedEvents([mk('e', '2026-09-12T10:00:00+05:30', [['p2', '2026-09-10T10:00:00+05:30']])], fetched, now)).toEqual([]);
  });
  it('does nothing when the fetch is empty', () => {
    expect(findRemovedEvents([mk('e', '2026-09-20T10:00:00+05:30', [['p2', '2026-09-10T10:00:00+05:30']])], [], now)).toEqual([]);
  });
});
