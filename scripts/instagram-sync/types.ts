import type { EventFields } from '../../src/lib/eventSchema';

export type Extraction = {
  isAnnouncement: boolean;
  confidence: 'high' | 'low';
  needsFallback: boolean;
  event?: Partial<EventFields>;
  reasons: string[];
};
