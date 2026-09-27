import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DraftSchema, EventSchema, StateSchema, type Draft, type Event, type State } from '../../src/lib/eventSchema';

export type Paths = { eventsDir: string; draftsDir: string; imagesDir: string; imagesPublicPrefix: string; statePath: string };
export type ChangeSet = { writeEvents: Event[]; deleteEvents: string[]; writeDrafts: Draft[]; deleteDrafts: string[]; state: State };

export function defaultPaths(root: string = process.cwd()): Paths {
  return {
    eventsDir: join(root, 'src/content/events'),
    draftsDir: join(root, 'data/drafts'),
    imagesDir: join(root, 'public/images/events'),
    imagesPublicPrefix: '/images/events',
    statePath: join(root, 'data/instagram-state.json'),
  };
}

const readJsonFiles = (dir: string) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, path: join(dir, f), content: readFileSync(join(dir, f), 'utf8') }));
};
const writeJson = (path: string, data: unknown) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');

export const readEvents = (p: Paths): Event[] =>
  readJsonFiles(p.eventsDir).map(({ file, content }) => {
    try {
      return EventSchema.parse(JSON.parse(content));
    } catch (e) {
      throw new Error(`Invalid ${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

export const readDrafts = (p: Paths): Draft[] =>
  readJsonFiles(p.draftsDir).map(({ file, content }) => {
    try {
      return DraftSchema.parse(JSON.parse(content));
    } catch (e) {
      throw new Error(`Invalid ${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

export const readState = (p: Paths): State =>
  existsSync(p.statePath) ? StateSchema.parse(JSON.parse(readFileSync(p.statePath, 'utf8'))) : { seenPostIds: [], lastRunAt: null, consecutiveFailures: 0 };

export function applyChanges(p: Paths, c: ChangeSet): void {
  for (const e of c.writeEvents) writeJson(join(p.eventsDir, `${e.id}.json`), e);
  for (const id of c.deleteEvents) rmSync(join(p.eventsDir, `${id}.json`), { force: true });
  for (const d of c.writeDrafts) writeJson(join(p.draftsDir, `${d.id}.json`), d);
  for (const id of c.deleteDrafts) rmSync(join(p.draftsDir, `${id}.json`), { force: true });
  writeJson(p.statePath, c.state);
}

export async function downloadImage(p: Paths, url: string | null, id: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) {
      console.warn(`image download failed for ${id}: HTTP ${res.status}`);
      return null;
    }
    writeFileSync(join(p.imagesDir, `${id}.jpg`), Buffer.from(await res.arrayBuffer()));
    return `${p.imagesPublicPrefix}/${id}.jpg`;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`image download failed for ${id}: ${message}`);
    return null;
  }
}
