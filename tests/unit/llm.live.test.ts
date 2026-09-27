import { describe, it, expect } from 'vitest';
import { llmExtract } from '../../scripts/instagram-sync/llm';
import { fixture } from './fixtures';

describe.runIf(process.env.LLM_LIVE)('llmExtract against a real local Ollama', () => {
  it('reads the synthetic free-form caption', async () => {
    const f = fixture('synthetic-freeform');
    const x = await llmExtract(f.caption, f.postedAt);
    expect(x.isAnnouncement).toBe(true);
    expect(x.event?.artForm).toMatch(/pearl/i);
  }, 120_000);
});
