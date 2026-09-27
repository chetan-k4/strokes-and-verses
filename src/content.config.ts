import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { EventSchema } from './lib/eventSchema';

export const collections = {
  events: defineCollection({
    loader: glob({ pattern: '*.json', base: './src/content/events' }),
    schema: EventSchema,
  }),
};
