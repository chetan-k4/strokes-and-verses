import { z } from 'astro/zod';

const isoWithOffset = z.string().datetime({ offset: true });

export const SourceSchema = z.object({
  postId: z.string().min(1),
  permalink: z.string().url(),
  postedAt: isoWithOffset,
});

export const EventFieldsSchema = z.object({
  title: z.string().min(1),
  artForm: z.string().min(1),
  start: isoWithOffset,
  end: isoWithOffset.nullable(),
  price: z.number().int().positive().nullable(),
  includes: z.array(z.string()),
  venue: z.string().min(1),
  description: z.string(),
});

export const EventSchema = EventFieldsSchema.extend({
  id: z.string().regex(/^[a-z0-9-]+$/),
  image: z.string().nullable(),
  sources: z.array(SourceSchema).min(1),
});

export const DraftSchema = z.object({
  id: z.string().regex(/^draft-[A-Za-z0-9_-]+$/),
  event: EventFieldsSchema.partial(),
  sources: z.array(SourceSchema).min(1),
  reasons: z.array(z.string()),
  draftIssue: z.number().int().positive().optional(),
  caption: z.string(),
});

export const StateSchema = z.object({
  seenPostIds: z.array(z.string()),
  lastRunAt: isoWithOffset.nullable(),
  consecutiveFailures: z.number().int().min(0),
  lastTokenRefreshAt: isoWithOffset.nullable().optional(),
});

export type Source = z.infer<typeof SourceSchema>;
export type EventFields = z.infer<typeof EventFieldsSchema>;
export type Event = z.infer<typeof EventSchema>;
export type Draft = z.infer<typeof DraftSchema>;
export type State = z.infer<typeof StateSchema>;
