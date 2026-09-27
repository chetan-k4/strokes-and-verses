import { getCollection } from 'astro:content';
import type { Event } from './eventSchema';
import { resolveNow, splitEvents } from './eventDates';

export async function loadEvents(): Promise<{ upcoming: Event[]; past: Event[] }> {
  const entries = await getCollection('events');
  return splitEvents(entries.map((e) => e.data as Event), resolveNow(process.env.SV_NOW));
}
