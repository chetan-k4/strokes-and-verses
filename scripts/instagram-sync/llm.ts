import { site } from '../../src/site.config';
import type { Extraction } from './types';

export type LlmOptions = { baseUrl?: string; model?: string; fetchImpl?: typeof fetch };

const SCHEMA = {
  type: 'object',
  properties: {
    isAnnouncement: { type: 'boolean' },
    artForm: { type: ['string', 'null'] },
    date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
    startTime: { type: ['string', 'null'], description: 'HH:MM 24-hour' },
    endTime: { type: ['string', 'null'], description: 'HH:MM 24-hour' },
    price: { type: ['number', 'null'], description: 'rupees per person' },
  },
  required: ['isAnnouncement', 'artForm', 'date', 'startTime', 'endTime', 'price'],
};

const system = (postedAt: string) =>
  `You read Instagram captions from an art studio in Chandigarh, India. The post was published at ${postedAt} (IST). ` +
  `Decide whether the caption announces a specific upcoming workshop people can book. Thank-you posts, recaps and teasers without a date are not announcements. ` +
  `If it is, give the art form, the calendar date (resolve words like "next sunday" relative to the publish date), start and end time in 24-hour HH:MM, and the price in rupees if stated. Use null for anything not stated. Never guess.`;

export async function llmExtract(caption: string, postedAt: string, opts: LlmOptions = {}): Promise<Extraction> {
  const baseUrl = opts.baseUrl ?? process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
  const model = opts.model ?? 'qwen2.5:3b-instruct';
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model, stream: false, format: SCHEMA, options: { temperature: 0 },
        messages: [{ role: 'system', content: system(postedAt) }, { role: 'user', content: caption }],
      }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const a = JSON.parse((await res.json()).message.content);
    if (!a.isAnnouncement) return { isAnnouncement: false, confidence: 'low', needsFallback: false, reasons: ['local model: not an announcement'] };
    const date = /^\d{4}-\d{2}-\d{2}$/.test(a.date ?? '') ? a.date : null;
    const hhmm = (t: unknown) => (typeof t === 'string' && /^\d{2}:\d{2}$/.test(t) ? t : null);
    const start = date && hhmm(a.startTime) ? `${date}T${hhmm(a.startTime)}:00+05:30` : undefined;
    const end = start && hhmm(a.endTime) ? `${date}T${hhmm(a.endTime)}:00+05:30` : null;
    const artForm = typeof a.artForm === 'string' && a.artForm.trim() ? a.artForm.trim() : undefined;
    return {
      isAnnouncement: true, confidence: 'low', needsFallback: false,
      event: {
        ...(artForm ? { artForm, title: `${artForm} Workshop` } : {}),
        ...(start ? { start, end } : {}),
        price: typeof a.price === 'number' && a.price >= 100 ? Math.round(a.price) : null,
        includes: [], venue: site.venue, description: '',
      },
      reasons: ['read by the local model; please check'],
    };
  } catch (err) {
    return { isAnnouncement: true, confidence: 'low', needsFallback: false, event: {}, reasons: [`could not read automatically: ${(err as Error).message}`] };
  }
}
