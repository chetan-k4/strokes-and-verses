import { EventFieldsSchema } from '../../src/lib/eventSchema';
import type { Extraction } from './types';

export type Decision = 'live' | 'draft' | 'ignore';

export function classify(x: Extraction): Decision {
  if (!x.isAnnouncement) return 'ignore';
  if (x.confidence === 'low') return 'draft';
  return EventFieldsSchema.safeParse(x.event).success ? 'live' : 'draft';
}
