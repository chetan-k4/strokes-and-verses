import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sync, needsLlm } from '../../scripts/instagram-sync/sync';
import { defaultPaths, readEvents, readDrafts, readState, type Paths } from '../../scripts/instagram-sync/store';
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
