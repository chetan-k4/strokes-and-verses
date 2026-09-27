import { pathToFileURL } from 'node:url';
import { EventFieldsSchema } from '../src/lib/eventSchema';
import { formatLongDate } from '../src/lib/eventDates';
import { applyChanges, defaultPaths, readDraftsTolerant, readEvents, readState, type Paths } from './instagram-sync/store';
import { buildEvent, dedupe } from './instagram-sync/dedupe';

export type ReviewResult = { ok: boolean; changed: boolean; message: string };

export function reviewDraft(paths: Paths, issueNumber: number, label: string): ReviewResult {
  if (label !== 'publish' && label !== 'discard') return { ok: true, changed: false, message: `Nothing to do for label "${label}".` };
  const { drafts, errors } = readDraftsTolerant(paths);
  const draft = drafts.find((d) => d.draftIssue === issueNumber);
  if (!draft) {
    if (errors.length) return { ok: false, changed: false, message: `Couldn't read this draft: ${errors.join('; ')}` };
    return { ok: true, changed: false, message: 'Already handled.' };
  }
  const state = readState(paths);

  if (label === 'discard') {
    applyChanges(paths, { writeEvents: [], deleteEvents: [], writeDrafts: [], deleteDrafts: [draft.id], state });
    return { ok: true, changed: true, message: 'Discarded. It won’t appear on the site.' };
  }

  const parsed = EventFieldsSchema.safeParse(draft.event);
  if (!parsed.success) {
    const missing = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].join(', ');
    return { ok: false, changed: false, message: `Can’t publish yet: ${missing} missing or invalid. Edit \`data/drafts/${draft.id}.json\` on GitHub, then add the \`publish\` label again.` };
  }
  const candidate = buildEvent(parsed.data, draft.sources, null);
  const r = dedupe(candidate, readEvents(paths));
  if (r.kind === 'skip') {
    applyChanges(paths, { writeEvents: [], deleteEvents: [], writeDrafts: [], deleteDrafts: [draft.id], state });
    return { ok: true, changed: true, message: `Already on the site: **${parsed.data.title}** on ${formatLongDate(parsed.data.start)}.` };
  }
  applyChanges(paths, { writeEvents: [r.event], deleteEvents: [], writeDrafts: [], deleteDrafts: [draft.id], state });
  return { ok: true, changed: true, message: `Published **${parsed.data.title}** on ${formatLongDate(parsed.data.start)}. The site will update in a few minutes.` };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [issue, label] = process.argv.slice(2);
  const r = reviewDraft(defaultPaths(), Number(issue), label ?? '');
  console.log(r.message);
  process.exit(r.ok ? 0 : 2);
}
