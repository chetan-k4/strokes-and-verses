import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { EventSchema, DraftSchema, StateSchema } from '../../src/lib/eventSchema';

const base = {
  id: 'kinusaiga-2026-09-19-1730', title: 'Kinusaiga Workshop', artForm: 'Kinusaiga',
  start: '2026-09-19T17:30:00+05:30', end: '2026-09-19T19:30:00+05:30', price: null,
  includes: ['All materials'], venue: 'Strokes & Verses Studio, Sector 37-B, Chandigarh',
  description: 'No paint. No needle.', image: null,
  sources: [{ postId: '1', permalink: 'https://www.instagram.com/strokesandverses/', postedAt: '2026-09-12T18:00:00+05:30' }],
};

describe('EventSchema', () => {
  it('accepts a valid event', () => expect(EventSchema.parse(base)).toEqual(base));
  it('rejects a start without offset', () => expect(() => EventSchema.parse({ ...base, start: '2026-09-19T17:30:00' })).toThrow());
  it('rejects uppercase ids', () => expect(() => EventSchema.parse({ ...base, id: 'Kinusaiga' })).toThrow());
  it('requires at least one source', () => expect(() => EventSchema.parse({ ...base, sources: [] })).toThrow());
  it('validates every committed event file', () => {
    for (const f of readdirSync('src/content/events').filter((f) => f.endsWith('.json'))) {
      const data = EventSchema.parse(JSON.parse(readFileSync(`src/content/events/${f}`, 'utf8')));
      expect(`${data.id}.json`).toBe(f);
    }
  });
});

describe('DraftSchema', () => {
  it('allows partial event fields', () => {
    expect(DraftSchema.parse({ id: 'draft-9', event: { artForm: 'Pearl Art' }, sources: base.sources, reasons: ['no date'], caption: 'x' }).event.artForm).toBe('Pearl Art');
  });
});

describe('StateSchema', () => {
  it('parses the committed state file', () => {
    expect(StateSchema.parse(JSON.parse(readFileSync('data/instagram-state.json', 'utf8')))).toEqual({ seenPostIds: [], lastRunAt: null, consecutiveFailures: 0 });
  });
});
