import { describe, it, expect } from 'vitest';
import { slugify, eventId, buildEvent, dedupe } from '../../scripts/instagram-sync/dedupe';

const fields = { title: 'Kinusaiga Workshop', artForm: 'Kinusaiga', start: '2026-09-19T17:30:00+05:30', end: '2026-09-19T19:30:00+05:30', price: null, includes: ['All materials'], venue: 'Studio', description: 'old' };
const src = (postId: string, postedAt: string) => ({ postId, permalink: `https://www.instagram.com/p/${postId}/`, postedAt });

describe('ids', () => {
  it('slugifies', () => expect(slugify('Paper Collage & Denim Pocket Frame')).toBe('paper-collage-denim-pocket-frame'));
  it('builds an IST-based id', () => expect(eventId('Kinusaiga', '2026-09-19T12:00:00Z')).toBe('kinusaiga-2026-09-19-1730'));
  it('buildEvent sets id, image, sources', () => {
    expect(buildEvent(fields, [src('a', '2026-09-11T18:00:00+05:30')], null)).toMatchObject({ id: 'kinusaiga-2026-09-19-1730', image: null, sources: [{ postId: 'a' }] });
  });
});

describe('dedupe', () => {
  const existing = buildEvent(fields, [src('a', '2026-09-11T18:00:00+05:30')], '/images/events/x.jpg');
  it('creates when no id matches', () => {
    const other = buildEvent({ ...fields, start: '2026-10-01T17:30:00+05:30', end: null }, [src('b', '2026-09-20T10:00:00+05:30')], null);
    expect(dedupe(other, [existing]).kind).toBe('create');
  });
  it('skips a post it has already merged', () => {
    expect(dedupe(buildEvent(fields, [src('a', '2026-09-11T18:00:00+05:30')], null), [existing])).toEqual({ kind: 'skip' });
  });
  it('newer repost updates fields, keeps image, merges sources in order', () => {
    const repost = buildEvent({ ...fields, description: 'new' }, [src('b', '2026-09-12T18:00:00+05:30')], null);
    const r = dedupe(repost, [existing]);
    expect(r.kind).toBe('update');
    if (r.kind !== 'update') return;
    expect(r.event.description).toBe('new');
    expect(r.event.image).toBe('/images/events/x.jpg');
    expect(r.event.sources.map((s) => s.postId)).toEqual(['a', 'b']);
  });
  it('older post only adds its source', () => {
    const older = buildEvent({ ...fields, description: 'older' }, [src('z', '2026-09-01T18:00:00+05:30')], null);
    const r = dedupe(older, [existing]);
    if (r.kind !== 'update') throw new Error('expected update');
    expect(r.event.description).toBe('old');
    expect(r.event.sources.map((s) => s.postId)).toEqual(['z', 'a']);
  });
});
