import { describe, it, expect } from 'vitest';
import { parseCaption } from '../../scripts/instagram-sync/parse';
import { matchArtForms } from '../../scripts/instagram-sync/artForms';
import { splitEvents } from '../../src/lib/eventDates';
import { fixture, fixtures } from './fixtures';

const parse = (name: string) => { const f = fixture(name); return parseCaption(f.caption, f.postedAt); };

describe('matchArtForms', () => {
  it('prefers the specific name over overlapping general ones', () => {
    expect(matchArtForms('Cloth Texture Art class')).toEqual(['Cloth Texture Art']);
    expect(matchArtForms('Boho Acrylic Painting')).toEqual(['Boho Acrylic Painting']);
  });
  it('handles KinuSaiGa spellings', () => expect(matchArtForms('KINUSAIGA and KinuSaiGa')).toEqual(['Kinusaiga']));
  it('returns several in canonical order, not order of appearance', () => expect(matchArtForms('old denim pockets, then Paper Collage')).toEqual(['Paper Collage', 'Denim Pocket Frame']));
  it('does not treat a plain mention of denim clothing as the Denim Pocket Frame workshop', () => {
    expect(matchArtForms('Wear your favourite denim jacket for this outdoor paint jam')).toEqual([]);
  });
  it('still matches the real double-art captions\' denim wording', () => {
    expect(matchArtForms('old denim pockets')).toEqual(['Denim Pocket Frame']);
  });
});

describe('parseCaption — announcements', () => {
  it('Kinusaiga 19 Sept (emoji details, no year)', () => {
    const x = parse('kinusaiga-19sept-a');
    expect(x).toMatchObject({ isAnnouncement: true, confidence: 'high', needsFallback: false });
    expect(x.event).toMatchObject({
      title: 'Kinusaiga Workshop', artForm: 'Kinusaiga',
      start: '2026-09-19T17:30:00+05:30', end: '2026-09-19T19:30:00+05:30',
      price: null, includes: ['All materials'], venue: 'Strokes & Verses Studio, Sector 37-B, Chandigarh',
    });
    expect(x.event!.description!.startsWith('No paint. No needle.')).toBe(true);
  });

  it('Double art Sunday combines two art forms', () => {
    const x = parse('double-art-20sept-a');
    expect(x.event).toMatchObject({
      title: 'Paper Collage & Denim Pocket Frame Workshop', artForm: 'Paper Collage & Denim Pocket Frame',
      start: '2026-09-20T15:30:00+05:30', end: '2026-09-20T17:30:00+05:30',
      includes: ['All materials', 'Refreshments'],
    });
    expect(x.confidence).toBe('high');
  });

  it('Kinusaiga 6 Sept (Date:/Time: labels, explicit year, Ask for the FEE)', () => {
    const x = parse('kinusaiga-6sept-labelled');
    expect(x.event).toMatchObject({
      start: '2026-09-06T15:30:00+05:30', end: '2026-09-06T17:30:00+05:30',
      price: null, includes: ['All materials', 'Frame', 'Refreshments'],
    });
    expect(x.confidence).toBe('high');
  });

  it('Kinusaiga 6 Sept (WHAT’S INCLUDED list)', () => {
    const x = parse('kinusaiga-6sept-details');
    expect(x.event).toMatchObject({ start: '2026-09-06T15:30:00+05:30', includes: ['All materials', 'Frame', 'Refreshments'] });
  });

  it('never takes the phone number as a price', () => {
    for (const f of fixtures) expect(parseCaption(f.caption, f.postedAt).event?.price ?? null).toBeNull();
  });
});

describe('parseCaption — prices, times, years', () => {
  const posted = '2026-09-01T10:00:00+05:30';
  const wrap = (details: string) => `PEARL ART IS BACK ✨\n\nSparkle all evening.\n\n${details}\n\nDM "PEARL" to book.`;
  it('reads ₹, Rs and /- prices', () => {
    expect(parseCaption(wrap('🗓️ Sunday, 5 October | 4 - 6 PM\n₹1,399 per person'), posted).event!.price).toBe(1399);
    expect(parseCaption(wrap('🗓️ Sunday, 5 October | 4 - 6 PM\nRs. 1299'), posted).event!.price).toBe(1299);
    expect(parseCaption(wrap('🗓️ Sunday, 5 October | 4 - 6 PM\nFee 1199/-'), posted).event!.price).toBe(1199);
  });
  it('infers am for a start that crosses noon', () => {
    expect(parseCaption(wrap('🗓️ Sunday, 5 October | 11:30 - 1:30 PM'), posted).event).toMatchObject({ start: '2026-10-05T11:30:00+05:30', end: '2026-10-05T13:30:00+05:30' });
  });
  it('rolls the year forward for January dates posted in December', () => {
    expect(parseCaption(wrap('🗓️ Saturday, 10th Jan | 5 - 7 PM'), '2026-12-20T10:00:00+05:30').event!.start).toBe('2027-01-10T17:00:00+05:30');
  });
  it('does not roll a recap date forward into next year just because it is a day or two before the post', () => {
    const caption = 'Kinusaiga workshop on 6 Sept, 3:30 - 5:30 PM was magical. DM to book the next one!';
    const x = parseCaption(caption, '2026-09-07T10:00:00+05:30');
    expect(x.event!.start).toBe('2026-09-06T15:30:00+05:30');
    expect(x.event!.start).not.toMatch(/^2027/);
  });
  it('a recap dated just before the post is not an upcoming event once now has passed it', () => {
    const caption = 'Kinusaiga workshop on 6 Sept, 3:30 - 5:30 PM was magical. DM to book the next one!';
    const x = parseCaption(caption, '2026-09-07T10:00:00+05:30');
    const now = new Date('2026-09-08T00:00:00+05:30');
    const { upcoming } = splitEvents([{ start: x.event!.start!, end: x.event!.end ?? null }], now);
    expect(upcoming).toHaveLength(0);
  });
  it('reads a single start time', () => {
    expect(parseCaption(wrap('🗓️ Sunday, 5 October\n⏰ 4 PM onwards'), posted).event).toMatchObject({ start: '2026-10-05T16:00:00+05:30', end: null });
  });
});

describe('parseCaption — ignored posts', () => {
  for (const name of ['hardy-sandhu-recap', 'two-days-thankyou', 'pearl-thankyou', 'brewing-teaser', 'kinusaiga-thankyou', 'kinusaiga-keywords-only']) {
    it(`${name} is not an announcement and needs no fallback`, () => {
      expect(parse(name)).toMatchObject({ isAnnouncement: false, needsFallback: false });
    });
  }
});

describe('parseCaption — fallback', () => {
  it('free-form caption with a date-like word and a booking cue asks for the LLM', () => {
    expect(parse('synthetic-freeform')).toMatchObject({ isAnnouncement: false, needsFallback: true });
  });
});
