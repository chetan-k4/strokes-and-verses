import { site } from '../site.config';
import { formatShortDate, formatTime } from './eventDates';

export type BookingIntent =
  | { kind: 'workshop'; title: string; start: string }
  | { kind: 'private'; artForm: string }
  | { kind: 'group'; artForm: string }
  | { kind: 'package'; name: string }
  | { kind: 'general' };

export function bookingMessage(intent: BookingIntent): string {
  switch (intent.kind) {
    case 'workshop': return `Hi Balpreet, I'd like to book the ${intent.title} on ${formatShortDate(intent.start)}, ${formatTime(intent.start)}.`;
    case 'private': return `Hi Balpreet, I'd like to book a private ${intent.artForm} class.`;
    case 'group': return `Hi Balpreet, I'd like to plan a group ${intent.artForm} session for ___ people.`;
    case 'package': return `Hi Balpreet, I'm interested in the ${intent.name} package.`;
    case 'general': return 'Hi Balpreet, I have a question about Strokes & Verses.';
  }
}

export function whatsappLink(intent: BookingIntent, number: string = site.whatsapp): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(bookingMessage(intent))}`;
}
