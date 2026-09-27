import { describe, it, expect } from 'vitest';
import { classify } from '../../scripts/instagram-sync/classify';
import { parseCaption } from '../../scripts/instagram-sync/parse';
import { fixtures } from './fixtures';

const full = { title: 'Kinusaiga Workshop', artForm: 'Kinusaiga', start: '2026-09-19T17:30:00+05:30', end: null, price: null, includes: [], venue: 'Studio', description: '' };

describe('classify', () => {
  it('ignores non-announcements', () => expect(classify({ isAnnouncement: false, confidence: 'high', needsFallback: false, reasons: [] })).toBe('ignore'));
  it('drafts low confidence', () => expect(classify({ isAnnouncement: true, confidence: 'low', needsFallback: false, event: full, reasons: [] })).toBe('draft'));
  it('drafts incomplete events', () => expect(classify({ isAnnouncement: true, confidence: 'high', needsFallback: false, event: { ...full, title: undefined }, reasons: [] })).toBe('draft'));
  it('publishes complete, confident events', () => expect(classify({ isAnnouncement: true, confidence: 'high', needsFallback: false, event: full, reasons: [] })).toBe('live'));
  it('matches every fixture expected outcome from the parser alone (fallback cases excluded)', () => {
    for (const f of fixtures.filter((f) => f.expected !== 'draft')) {
      expect([f.name, classify(parseCaption(f.caption, f.postedAt))]).toEqual([f.name, f.expected]);
    }
  });
});
