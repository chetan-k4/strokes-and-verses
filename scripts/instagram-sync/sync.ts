import type { Draft, Event, EventFields, Source } from '../../src/lib/eventSchema';
import { istParts } from '../../src/lib/eventDates';
import { parseCaption } from './parse';
import { classify } from './classify';
import { buildEvent, dedupe } from './dedupe';
import { findRemovedEvents } from './removal';
import { applyChanges, readEvents, readState, type Paths } from './store';
import { draftIssueBody, draftIssueTitle, type GhClient } from './issues';
import type { IgMedia } from './instagram';
import type { Extraction } from './types';

export type SyncDeps = {
  media: IgMedia[];
  now: Date;
  paths: Paths;
  llm: (caption: string, postedAt: string) => Promise<Extraction>;
  gh: GhClient;
  download: (url: string | null, id: string) => Promise<string | null>;
  /** ISO timestamp if the Instagram token was refreshed this run; undefined to leave the stored value untouched. */
  tokenRefreshedAt?: string | null;
};
export type SyncResult = { created: string[]; updated: string[]; drafted: string[]; ignored: string[]; removed: string[] };

const pad = (n: number) => String(n).padStart(2, '0');
export const istIso = (d: Date) => {
  const p = istParts(d.toISOString());
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(d.getUTCSeconds())}+05:30`;
};

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export function needsLlm(media: IgMedia[], seen: string[]): boolean {
  const s = new Set(seen);
  return media.some((m) => !s.has(m.id) && parseCaption(m.caption, m.timestamp).needsFallback);
}

export async function sync(d: SyncDeps): Promise<SyncResult> {
  const state = readState(d.paths);
  const seen = new Set(state.seenPostIds);
  const events = new Map<string, Event>(readEvents(d.paths).map((e) => [e.id, e]));
  const result: SyncResult = { created: [], updated: [], drafted: [], ignored: [], removed: [] };
  const writeEvents = new Map<string, Event>();
  const pendingDrafts: { draft: Draft; permalink: string }[] = [];

  const fresh = d.media.filter((m) => !seen.has(m.id)).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  for (const m of fresh) {
    const source: Source = { postId: m.id, permalink: m.permalink, postedAt: m.timestamp };
    let x = parseCaption(m.caption, m.timestamp);
    if (x.needsFallback) x = await d.llm(m.caption, m.timestamp);
    const decision = classify(x);

    if (decision === 'ignore') result.ignored.push(m.id);
    if (decision === 'draft') {
      const start = x.event?.start;
      if (start && Date.parse(start) < d.now.getTime() - FOURTEEN_DAYS_MS) {
        // First-run backlog: a would-be draft for a workshop that already happened
        // long ago (e.g. reading the last 25 historical posts for the first time)
        // is not worth a draft issue — treat it as ignored, still marking it seen.
        result.ignored.push(m.id);
      } else {
        const draft: Draft = { id: `draft-${m.id}`, event: x.event ?? {}, sources: [source], reasons: x.reasons, caption: m.caption };
        pendingDrafts.push({ draft, permalink: m.permalink });
        result.drafted.push(draft.id);
      }
    }
    if (decision === 'live') {
      const candidate = buildEvent(x.event as EventFields, [source], null);
      const r = dedupe(candidate, [...events.values()]);
      if (r.kind !== 'skip') {
        const event = r.event.image ? r.event : { ...r.event, image: await d.download(m.imageUrl, r.event.id) };
        events.set(event.id, event);
        writeEvents.set(event.id, event);
        (r.kind === 'create' ? result.created : result.updated).push(event.id);
      }
    }
    seen.add(m.id);
  }

  result.removed = findRemovedEvents([...events.values()], d.media.map((m) => ({ id: m.id, timestamp: m.timestamp })), d.now);
  for (const id of result.removed) writeEvents.delete(id);

  const newState = { seenPostIds: [...seen], lastRunAt: istIso(d.now), consecutiveFailures: 0, lastTokenRefreshAt: d.tokenRefreshedAt !== undefined ? d.tokenRefreshedAt : (state.lastTokenRefreshAt ?? null) };

  // Persist events, drafts (without their issue numbers yet) and state FIRST, so a
  // later GitHub failure can never orphan an issue or lose track of what was seen.
  applyChanges(d.paths, {
    writeEvents: [...writeEvents.values()],
    deleteEvents: result.removed,
    writeDrafts: pendingDrafts.map((p) => p.draft),
    deleteDrafts: [],
    state: newState,
  });

  // Now create the draft issues. If one throws, everything above is already
  // durable on disk — the next run will simply retry opening an issue for it.
  for (const { draft, permalink } of pendingDrafts) {
    draft.draftIssue = await d.gh.createIssue(draftIssueTitle(draft), draftIssueBody(draft, permalink), ['draft']);
    applyChanges(d.paths, { writeEvents: [], deleteEvents: [], writeDrafts: [draft], deleteDrafts: [], state: newState });
  }

  return result;
}
