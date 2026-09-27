import type { Event } from '../../src/lib/eventSchema';

export function findRemovedEvents(events: Event[], fetched: { id: string; timestamp: string }[], now: Date): string[] {
  if (fetched.length === 0) return [];
  const oldest = Math.min(...fetched.map((m) => Date.parse(m.timestamp)));
  const ids = new Set(fetched.map((m) => m.id));
  return events
    .filter((e) => Date.parse(e.end ?? e.start) >= now.getTime())
    .filter((e) => e.sources.every((s) => !ids.has(s.postId) && Date.parse(s.postedAt) > oldest))
    .map((e) => e.id);
}
