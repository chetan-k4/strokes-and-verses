import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sync, needsLlm } from '../../scripts/instagram-sync/sync';
import { defaultPaths, readEvents, readDrafts, readState, applyChanges, type Paths } from '../../scripts/instagram-sync/store';
import type { IgMedia } from '../../scripts/instagram-sync/instagram';
import { fixtures } from './fixtures';

let p: Paths;
const issues: { title: string; labels: string[] }[] = [];
const gh = { createIssue: async (title: string, _b: string, labels: string[]) => { issues.push({ title, labels }); return 100 + issues.length; } };
const media: IgMedia[] = fixtures.map((f) => ({ id: f.postId, caption: f.caption, mediaType: 'IMAGE', imageUrl: null, permalink: 'https://www.instagram.com/strokesandverses/', timestamp: f.postedAt }))
  .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
const llm = async () => ({ isAnnouncement: true, confidence: 'low' as const, needsFallback: false, event: { artForm: 'Pearl Art', title: 'Pearl Art Workshop' }, reasons: ['read by the local model; please check'] });
const now = new Date('2026-09-28T08:00:00+05:30');

beforeEach(() => {
  issues.length = 0;
  const root = mkdtempSync(join(tmpdir(), 'sv-sync-'));
  p = defaultPaths(root);
  for (const d of [p.eventsDir, p.draftsDir, p.imagesDir, join(root, 'data')]) mkdirSync(d, { recursive: true });
});

describe('sync over the real caption fixtures', () => {
  it('needs the LLM only because of the free-form caption', () => {
    expect(needsLlm(media, [])).toBe(true);
    expect(needsLlm(media, ['fixture-synthetic-freeform'])).toBe(false);
  });

  it('produces exactly the three seed events, one draft and ignores the rest', async () => {
    const r = await sync({ media, now, paths: p, llm, gh, download: async () => null });
    expect(r.created.sort()).toEqual(['kinusaiga-2026-09-06-1530', 'kinusaiga-2026-09-19-1730', 'paper-collage-denim-pocket-frame-2026-09-20-1530']);
    expect(r.updated.sort()).toEqual(r.created.slice().sort());
    expect(r.drafted).toEqual(['draft-fixture-synthetic-freeform']);
    expect(r.ignored).toHaveLength(6);

    const seeds = ['kinusaiga-2026-09-06-1530', 'kinusaiga-2026-09-19-1730', 'paper-collage-denim-pocket-frame-2026-09-20-1530']
      .map((id) => JSON.parse(readFileSync(`src/content/events/${id}.json`, 'utf8')));
    expect(readEvents(p)).toEqual(seeds);

    const [draft] = readDrafts(p);
    expect(draft).toMatchObject({ id: 'draft-fixture-synthetic-freeform', draftIssue: 101 });
    expect(issues).toEqual([{ title: 'Draft: new Instagram post needs a look', labels: ['draft'] }]);

    const state = readState(p);
    expect(state.seenPostIds).toHaveLength(fixtures.length);
    expect(state.lastRunAt).toBe('2026-09-28T08:00:00+05:30');
  });

  it('is idempotent: a second run changes nothing', async () => {
    await sync({ media, now, paths: p, llm, gh, download: async () => null });
    const r = await sync({ media, now, paths: p, llm, gh, download: async () => null });
    expect(r).toEqual({ created: [], updated: [], drafted: [], ignored: [], removed: [] });
    expect(issues).toHaveLength(1);
  });

  it('stores the downloaded image path on created events', async () => {
    await sync({ media, now, paths: p, llm, gh, download: async (_u, id) => `/images/events/${id}.jpg` });
    expect(readEvents(p).every((e) => e.image === `/images/events/${e.id}.jpg`)).toBe(true);
  });
});

describe('sync — token refresh timestamp', () => {
  it('carries the last token refresh time forward when this run did not refresh', async () => {
    applyChanges(p, { writeEvents: [], deleteEvents: [], writeDrafts: [], deleteDrafts: [],
      state: { seenPostIds: [], lastRunAt: null, consecutiveFailures: 0, lastTokenRefreshAt: '2026-09-20T08:00:00+05:30' } });
    await sync({ media, now, paths: p, llm, gh, download: async () => null });
    expect(readState(p).lastTokenRefreshAt).toBe('2026-09-20T08:00:00+05:30');
  });

  it('records a fresh token refresh time when this run refreshed', async () => {
    await sync({ media, now, paths: p, llm, gh, download: async () => null, tokenRefreshedAt: '2026-09-28T08:00:00+05:30' });
    expect(readState(p).lastTokenRefreshAt).toBe('2026-09-28T08:00:00+05:30');
  });
});

describe('sync — first-run backlog', () => {
  it('ignores a would-be draft whose extracted start date is more than 14 days before now, but still marks it seen', async () => {
    const old: IgMedia = {
      id: 'old-1', caption: 'DM to book your spot for our January workshop!', mediaType: 'IMAGE',
      imageUrl: null, permalink: 'https://www.instagram.com/p/old1/', timestamp: '2026-01-01T10:00:00+05:30',
    };
    const oldLlm = async () => ({ isAnnouncement: true, confidence: 'low' as const, needsFallback: false, event: { start: '2026-01-05T15:00:00+05:30' }, reasons: ['low confidence'] });
    const r = await sync({ media: [old], now, paths: p, llm: oldLlm, gh, download: async () => null });
    expect(r.drafted).toEqual([]);
    expect(r.ignored).toEqual(['old-1']);
    expect(issues).toEqual([]);
    expect(readDrafts(p)).toEqual([]);
    expect(readState(p).seenPostIds).toContain('old-1');
  });

  it('still drafts (and opens an issue for) a recent low-confidence post', async () => {
    const recent: IgMedia = {
      id: 'recent-1', caption: 'DM to book your spot for our September workshop!', mediaType: 'IMAGE',
      imageUrl: null, permalink: 'https://www.instagram.com/p/recent1/', timestamp: '2026-09-20T10:00:00+05:30',
    };
    const recentLlm = async () => ({ isAnnouncement: true, confidence: 'low' as const, needsFallback: false, event: { start: '2026-09-27T15:00:00+05:30' }, reasons: ['low confidence'] });
    const r = await sync({ media: [recent], now, paths: p, llm: recentLlm, gh, download: async () => null });
    expect(r.drafted).toEqual(['draft-recent-1']);
    expect(r.ignored).toEqual([]);
    expect(issues).toHaveLength(1);
  });
});

describe('sync — issue creation ordering', () => {
  it('persists the draft file and seen ids even when issue creation throws, and propagates the error', async () => {
    const failingGh = { createIssue: async (): Promise<number> => { throw new Error('gh is down'); } };
    await expect(sync({ media, now, paths: p, llm, gh: failingGh, download: async () => null })).rejects.toThrow('gh is down');
    const drafts = readDrafts(p);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBe('draft-fixture-synthetic-freeform');
    expect(drafts[0].draftIssue).toBeUndefined();
    expect(readState(p).seenPostIds).toHaveLength(fixtures.length);
  });
});
