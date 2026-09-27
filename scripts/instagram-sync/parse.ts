import { site } from '../../src/site.config';
import { istParts } from '../../src/lib/eventDates';
import type { EventFields } from '../../src/lib/eventSchema';
import { matchArtForms } from './artForms';
import type { Extraction } from './types';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const IGNORE = /(thank\s*you|thanks to|thanx|gratitude|successfully completed|stay tuned|is brewing|coming soon)/i;
const BOOKING = /\b(dm|call|book|reserve|message|whatsapp|register)\b/i;
const DATE_LIKE = /\b(mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?|sun)(day)?\b|\btomorrow\b|\btonight\b|\b(jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
const DATE_RE = /(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?(?:\s+(\d{4}))?/i;
const RANGE_RE = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
const SINGLE_RE = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
const PRICE_RE = /(?:₹|\brs\.?|\binr)\s*([\d,]{3,7})|\b([\d,]{3,7})\s*\/-/i;
const NO_PRICE = /ask\s+for\s+(the\s+)?fee/i;
const INCLUDES: [RegExp, string][] = [
  [/all materials|materials (provided|included)/i, 'All materials'],
  [/frame (for your artwork|included|to take home)|frame your own art/i, 'Frame'],
  [/refreshments|\bchai\b/i, 'Refreshments'],
];
const EMOJI = /[\p{Extended_Pictographic}️‍]/gu;

const pad = (n: number) => String(n).padStart(2, '0');
const lineWith = (text: string, re: RegExp) => text.split('\n').find((l) => re.test(l));

function toHour(h: number, meridiem: string) {
  const m = meridiem.toLowerCase();
  if (m === 'pm' && h < 12) return h + 12;
  if (m === 'am' && h === 12) return 0;
  return h;
}

function findDate(body: string, postedAt: string) {
  const line = lineWith(body, /🗓|📅|\bdate\s*:/i);
  const m = (line && line.match(DATE_RE)) || body.match(DATE_RE);
  if (!m) return null;
  const day = +m[1];
  const month = MONTHS.indexOf(m[2].toLowerCase().slice(0, 3)) + 1;
  const posted = istParts(postedAt);
  let year = m[3] ? +m[3] : posted.year;
  if (!m[3]) {
    // No explicit year: only roll into next year when the yearless date is well
    // (>60 days) BEFORE the post date — the Dec-posted/Jan-workshop case. A date
    // only a few days before the post (e.g. a recap caption for a workshop that
    // just happened) stays in the post's own year instead of jumping to next year.
    const postedUtc = Date.UTC(posted.year, posted.month - 1, posted.day);
    const candidateUtc = Date.UTC(year, month - 1, day);
    const daysBefore = (postedUtc - candidateUtc) / 86_400_000;
    if (daysBefore > 60) year += 1;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function findTimes(body: string): { start: string; end: string | null } | null {
  const line = lineWith(body, /⏰|\btime\s*:/i) ?? lineWith(body, RANGE_RE) ?? lineWith(body, SINGLE_RE);
  const source = line ?? body;
  const r = source.match(RANGE_RE);
  if (r) {
    const h1 = +r[1], m1 = +(r[2] ?? 0), h2 = +r[4], m2 = +(r[5] ?? 0), mer2 = r[6];
    let mer1 = r[3] ?? mer2;
    if (!r[3] && mer2.toLowerCase() === 'pm' && h1 > h2 && h1 < 12) mer1 = 'am';
    return { start: `${pad(toHour(h1, mer1))}:${pad(m1)}`, end: `${pad(toHour(h2, mer2))}:${pad(m2)}` };
  }
  const s = source.match(SINGLE_RE);
  if (s) return { start: `${pad(toHour(+s[1], s[3]))}:${pad(+(s[2] ?? 0))}`, end: null };
  return null;
}

function findPrice(body: string): number | null {
  if (NO_PRICE.test(body)) return null;
  const m = body.match(PRICE_RE);
  if (!m) return null;
  const n = parseInt((m[1] ?? m[2]).replace(/,/g, ''), 10);
  return Number.isFinite(n) && n >= 100 && n <= 100000 ? n : null;
}

function findVenue(body: string): string {
  const line = lineWith(body, /📍|\bvenue\s*:/i);
  if (!line) return site.venue;
  const text = line.replace(EMOJI, '').replace(/venue\s*:/i, '').trim();
  return /strokes\s*(and|&)\s*verses/i.test(text) ? site.venue : text;
}

function findDescription(body: string): string {
  const paras = body.split(/\n\s*\n/).map((p) => p.replace(EMOJI, '').replace(/\s+/g, ' ').trim());
  const p = paras.find((x) => x.length >= 60 && !DATE_RE.test(x) && !BOOKING.test(x) && !/^(workshop details|includes|what.s included)/i.test(x)) ?? '';
  if (p.length <= 220) return p;
  const cut = p.slice(0, 220);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '));
  return end > 60 ? cut.slice(0, end + 1) : cut.trimEnd() + '…';
}

export function parseCaption(caption: string, postedAt: string): Extraction {
  const text = caption.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\t/g, ' ');
  const body = text.split(/\n\s*#|keywords/i)[0];
  const reasons: string[] = [];

  const date = findDate(body, postedAt);
  const times = findTimes(body);
  const names = matchArtForms(body);
  const booking = BOOKING.test(body);
  const ignoreSignal = IGNORE.test(body);

  if (!date || !times) {
    const needsFallback = !ignoreSignal && booking && DATE_LIKE.test(body);
    if (!date) reasons.push('no date found');
    if (!times) reasons.push('no time found');
    return { isAnnouncement: false, confidence: needsFallback ? 'low' : 'high', needsFallback, reasons };
  }

  const event: Partial<EventFields> = {
    start: `${date}T${times.start}:00+05:30`,
    end: times.end ? `${date}T${times.end}:00+05:30` : null,
    price: findPrice(body),
    includes: INCLUDES.filter(([re]) => re.test(body)).map(([, label]) => label),
    venue: findVenue(body),
    description: findDescription(body),
  };
  if (names.length) {
    event.artForm = names.join(' & ');
    event.title = `${event.artForm} Workshop`;
  } else reasons.push('no known art form');
  if (!booking) reasons.push('no booking cue');
  if (ignoreSignal) reasons.push('reads like a thank-you or teaser');

  const confidence = names.length && booking && !ignoreSignal ? 'high' : 'low';
  return { isAnnouncement: true, confidence, needsFallback: false, event, reasons };
}
