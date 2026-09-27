import { describe, it, expect } from 'vitest';
import { bookingMessage, whatsappLink } from '../../src/lib/whatsappLink';

describe('bookingMessage', () => {
  it('workshop', () => expect(bookingMessage({ kind: 'workshop', title: 'Kinusaiga Workshop', start: '2026-09-19T17:30:00+05:30' }))
    .toBe("Hi Balpreet, I'd like to book the Kinusaiga Workshop on Sat 19 Sept, 5:30 pm."));
  it('private', () => expect(bookingMessage({ kind: 'private', artForm: 'Pearl Art' })).toBe("Hi Balpreet, I'd like to book a private Pearl Art class."));
  it('group', () => expect(bookingMessage({ kind: 'group', artForm: 'Pearl Art' })).toBe("Hi Balpreet, I'd like to plan a group Pearl Art session for ___ people."));
  it('package', () => expect(bookingMessage({ kind: 'package', name: 'Full Canvas' })).toBe("Hi Balpreet, I'm interested in the Full Canvas package."));
  it('general', () => expect(bookingMessage({ kind: 'general' })).toBe('Hi Balpreet, I have a question about Strokes & Verses.'));
});

describe('whatsappLink', () => {
  it('builds a wa.me link with the encoded message to the studio number', () => {
    const href = whatsappLink({ kind: 'general' });
    const u = new URL(href);
    expect(u.origin + u.pathname).toBe('https://wa.me/919501690208');
    expect(u.searchParams.get('text')).toBe('Hi Balpreet, I have a question about Strokes & Verses.');
  });
});
