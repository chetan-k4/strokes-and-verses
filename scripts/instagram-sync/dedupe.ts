import type { Event, EventFields, Source } from '../../src/lib/eventSchema';
import { istParts } from '../../src/lib/eventDates';

const pad = (n: number) => String(n).padStart(2, '0');

export function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function eventId(artForm: string, start: string): string {
  const p = istParts(start);
  return `${slugify(artForm)}-${p.year}-${pad(p.month)}-${pad(p.day)}-${pad(p.hour)}${pad(p.minute)}`;
}

export function buildEvent(fields: EventFields, sources: Source[], image: string | null): Event {
  return { id: eventId(fields.artForm, fields.start), ...fields, image, sources };
}

export type DedupeResult = { kind: 'create'; event: Event } | { kind: 'update'; event: Event } | { kind: 'skip' };

const newest = (e: Event) => Math.max(...e.sources.map((s) => Date.parse(s.postedAt)));

export function dedupe(candidate: Event, existing: Event[]): DedupeResult {
  const match = existing.find((e) => e.id === candidate.id);
  if (!match) return { kind: 'create', event: candidate };
  const known = new Set(match.sources.map((s) => s.postId));
  const fresh = candidate.sources.filter((s) => !known.has(s.postId));
  if (fresh.length === 0) return { kind: 'skip' };
  const sources = [...match.sources, ...fresh].sort((a, b) => Date.parse(a.postedAt) - Date.parse(b.postedAt));
  const base = newest(candidate) > newest(match)
    ? { ...candidate, id: match.id, image: candidate.image ?? match.image }
    : match;
  return { kind: 'update', event: { ...base, sources } };
}
