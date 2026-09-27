import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reviewDraft } from '../../scripts/review-draft';
import { defaultPaths, applyChanges, readEvents, readDrafts, readState, type Paths } from '../../scripts/instagram-sync/store';

let p: Paths;
const source = { postId: '9', permalink: 'https://www.instagram.com/p/9/', postedAt: '2026-09-25T18:00:00+05:30' };
const complete = { title: 'Pearl Art Workshop', artForm: 'Pearl Art', start: '2026-10-04T17:00:00+05:30', end: null, price: null, includes: [], venue: 'Studio', description: '' };

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'sv-rev-'));
  p = defaultPaths(root);
  for (const d of [p.eventsDir, p.draftsDir, p.imagesDir, join(root, 'data')]) mkdirSync(d, { recursive: true });
});

const seed = (event: object) => applyChanges(p, { writeEvents: [], deleteEvents: [], deleteDrafts: [], state: readState(p),
  writeDrafts: [{ id: 'draft-9', event, sources: [source], reasons: [], caption: 'c', draftIssue: 7 }] });

describe('reviewDraft', () => {
  it('publish moves a complete draft to a live event', () => {
    seed(complete);
    const r = reviewDraft(p, 7, 'publish');
    expect(r).toEqual({ ok: true, changed: true, message: 'Published **Pearl Art Workshop** on Sunday 4 October. The site will update in a few minutes.' });
    expect(readEvents(p).map((e) => e.id)).toEqual(['pearl-art-2026-10-04-1700']);
    expect(readDrafts(p)).toEqual([]);
  });
  it('publish refuses an incomplete draft and names what is missing', () => {
    seed({ artForm: 'Pearl Art' });
    const r = reviewDraft(p, 7, 'publish');
    expect(r.ok).toBe(false);
    expect(r.changed).toBe(false);
    expect(r.message).toContain('title, start');
    expect(r.message).toContain('data/drafts/draft-9.json');
    expect(existsSync(join(p.draftsDir, 'draft-9.json'))).toBe(true);
  });
  it('discard deletes the draft', () => {
    seed(complete);
    expect(reviewDraft(p, 7, 'discard')).toEqual({ ok: true, changed: true, message: 'Discarded. It won\'t appear on the site.' });
    expect(readDrafts(p)).toEqual([]);
  });
  it('is idempotent when the draft is gone', () => {
    expect(reviewDraft(p, 7, 'publish')).toEqual({ ok: true, changed: false, message: 'Already handled.' });
  });
  it('ignores other labels', () => {
    seed(complete);
    expect(reviewDraft(p, 7, 'bug')).toEqual({ ok: true, changed: false, message: 'Nothing to do for label "bug".' });
  });
});
