import { describe, it, expect } from 'vitest';
import { llmExtract } from '../../scripts/instagram-sync/llm';

const reply = (obj: unknown) => (async (_url: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body));
  expect(body.model).toBe('qwen2.5:3b-instruct');
  expect(body.stream).toBe(false);
  expect(body.format).toHaveProperty('properties.isAnnouncement');
  return new Response(JSON.stringify({ message: { content: JSON.stringify(obj) } }));
}) as typeof fetch;

describe('llmExtract', () => {
  it('maps a model answer to a low-confidence extraction', async () => {
    const x = await llmExtract('Pearl art next sunday evening, message me', '2026-09-25T18:00:00+05:30', {
      fetchImpl: reply({ isAnnouncement: true, artForm: 'Pearl Art', date: '2026-10-04', startTime: '17:00', endTime: null, price: null }),
    });
    expect(x).toMatchObject({ isAnnouncement: true, confidence: 'low', needsFallback: false });
    expect(x.event).toMatchObject({ artForm: 'Pearl Art', title: 'Pearl Art Workshop', start: '2026-10-04T17:00:00+05:30', end: null, price: null });
  });
  it('passes through "not an announcement"', async () => {
    const x = await llmExtract('thanks all', '2026-09-25T18:00:00+05:30', { fetchImpl: reply({ isAnnouncement: false, artForm: null, date: null, startTime: null, endTime: null, price: null }) });
    expect(x.isAnnouncement).toBe(false);
  });
  it('drops malformed dates instead of inventing them', async () => {
    const x = await llmExtract('c', '2026-09-25T18:00:00+05:30', { fetchImpl: reply({ isAnnouncement: true, artForm: 'Pearl Art', date: 'next sunday', startTime: '5pm', endTime: null, price: null }) });
    expect(x.event?.start).toBeUndefined();
  });
  it('turns errors into a draft-worthy extraction', async () => {
    const down = (async () => { throw new Error('ECONNREFUSED'); }) as typeof fetch;
    const x = await llmExtract('c', '2026-09-25T18:00:00+05:30', { fetchImpl: down });
    expect(x).toMatchObject({ isAnnouncement: true, confidence: 'low', event: {} });
    expect(x.reasons[0]).toMatch(/could not read automatically/);
  });
  it('normalizes raw artForm through matchArtForms', async () => {
    const x = await llmExtract('workshop', '2026-09-25T18:00:00+05:30', {
      fetchImpl: reply({ isAnnouncement: true, artForm: 'kinusaiga', date: '2026-10-04', startTime: '17:00', endTime: null, price: null }),
    });
    expect(x.event?.artForm).toBe('Kinusaiga');
    expect(x.event?.title).toBe('Kinusaiga Workshop');
  });
  it('rejects prices outside 100–100000 range', async () => {
    const x = await llmExtract('c', '2026-09-25T18:00:00+05:30', {
      fetchImpl: reply({ isAnnouncement: true, artForm: 'Pearl Art', date: '2026-10-04', startTime: '17:00', endTime: null, price: 250000 }),
    });
    expect(x.event?.price).toBe(null);
  });
});
