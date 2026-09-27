import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultPaths, readEvents, readDrafts, readState, applyChanges, downloadImage, type Paths } from '../../scripts/instagram-sync/store';

let p: Paths;
const ev = { id: 'kinusaiga-2026-09-19-1730', title: 'Kinusaiga Workshop', artForm: 'Kinusaiga', start: '2026-09-19T17:30:00+05:30', end: null, price: null, includes: [], venue: 'Studio', description: '', image: null, sources: [{ postId: 'a', permalink: 'https://www.instagram.com/p/a/', postedAt: '2026-09-11T18:00:00+05:30' }] };

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'sv-'));
  p = defaultPaths(root);
  for (const d of [p.eventsDir, p.draftsDir, p.imagesDir, join(root, 'data')]) mkdirSync(d, { recursive: true });
});

describe('store — missing directories', () => {
  it('creates the events/drafts/state directories on write if they were deleted (e.g. git dropped an empty folder)', () => {
    const root = mkdtempSync(join(tmpdir(), 'sv-nodir-'));
    const fresh = defaultPaths(root);
    const draft = { id: 'draft-9', event: {}, sources: ev.sources, reasons: ['x'], caption: 'c' };
    expect(() => applyChanges(fresh, {
      writeEvents: [ev], deleteEvents: [], writeDrafts: [draft], deleteDrafts: [],
      state: { seenPostIds: [], lastRunAt: null, consecutiveFailures: 0 },
    })).not.toThrow();
    expect(readEvents(fresh)).toEqual([ev]);
    expect(readDrafts(fresh)).toEqual([draft]);
  });

  it('creates the images directory before writing a downloaded image', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sv-nodir-img-'));
    const fresh = defaultPaths(root);
    const fake = (async () => new Response(new Uint8Array([1, 2, 3]))) as typeof fetch;
    await expect(downloadImage(fresh, 'https://cdn/x.jpg', 'e1', fake)).resolves.toBe('/images/events/e1.jpg');
  });
});

describe('store', () => {
  it('defaults state when the file is missing', () => expect(readState(p)).toEqual({ seenPostIds: [], lastRunAt: null, consecutiveFailures: 0, lastTokenRefreshAt: null }));
  it('writes and reads back events, drafts and state', () => {
    const draft = { id: 'draft-9', event: {}, sources: ev.sources, reasons: ['x'], caption: 'c', draftIssue: 3 };
    const state = { seenPostIds: ['a'], lastRunAt: '2026-09-28T08:00:00+05:30', consecutiveFailures: 0 };
    applyChanges(p, { writeEvents: [ev], deleteEvents: [], writeDrafts: [draft], deleteDrafts: [], state });
    expect(readEvents(p)).toEqual([ev]);
    expect(readDrafts(p)).toEqual([draft]);
    expect(readState(p)).toEqual(state);
    expect(readFileSync(join(p.eventsDir, `${ev.id}.json`), 'utf8').endsWith('}\n')).toBe(true);
  });
  it('deletes events and drafts', () => {
    applyChanges(p, { writeEvents: [ev], deleteEvents: [], writeDrafts: [], deleteDrafts: [], state: readState(p) });
    writeFileSync(join(p.draftsDir, 'draft-1.json'), '{}');
    applyChanges(p, { writeEvents: [], deleteEvents: [ev.id], writeDrafts: [], deleteDrafts: ['draft-1'], state: readState(p) });
    expect(existsSync(join(p.eventsDir, `${ev.id}.json`))).toBe(false);
    expect(existsSync(join(p.draftsDir, 'draft-1.json'))).toBe(false);
  });
  it('ignores .gitkeep', () => {
    writeFileSync(join(p.eventsDir, '.gitkeep'), '');
    expect(readEvents(p)).toEqual([]);
  });
  it('throws with filename when JSON is malformed', () => {
    writeFileSync(join(p.eventsDir, 'bad.json'), '{"id":"Bad"}');
    expect(() => readEvents(p)).toThrow(/bad\.json/);
  });
});

describe('downloadImage', () => {
  it('saves the bytes and returns the public path', async () => {
    const fake = (async () => new Response(new Uint8Array([1, 2, 3]))) as typeof fetch;
    expect(await downloadImage(p, 'https://cdn/x.jpg', 'e1', fake)).toBe('/images/events/e1.jpg');
    expect(readFileSync(join(p.imagesDir, 'e1.jpg'))).toEqual(Buffer.from([1, 2, 3]));
  });
  it('returns null on failure or missing url and logs warning', async () => {
    const bad = (async () => new Response('no', { status: 403 })) as typeof fetch;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await downloadImage(p, 'https://cdn/x.jpg', 'e2', bad)).toBeNull();
    expect(await downloadImage(p, null, 'e3', bad)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('image download failed for e2'));
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('e3'));
    warnSpy.mockRestore();
  });
});
