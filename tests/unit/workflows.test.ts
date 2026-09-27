import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const wf = (name: string) => readFileSync(`.github/workflows/${name}`, 'utf8');

describe('workflows', () => {
  it('sync runs at 08:00 and 20:00 IST and can be run by hand', () => {
    const y = wf('instagram-sync.yml');
    expect(y).toContain("cron: '30 2 * * *'");
    expect(y).toContain("cron: '30 14 * * *'");
    expect(y).toContain('workflow_dispatch');
  });
  it('sync installs Ollama only when the plan asks for it', () => {
    const y = wf('instagram-sync.yml');
    expect(y).toMatch(/if: steps\.plan\.outputs\.needs_llm == 'true'[\s\S]*ollama/);
  });
  it('sync triggers a deploy (GITHUB_TOKEN pushes do not trigger workflows)', () => {
    expect(wf('instagram-sync.yml')).toContain('gh workflow run deploy.yml');
    expect(wf('review-draft.yml')).toContain('gh workflow run deploy.yml');
  });
  it('untrusted event values are passed through env, never interpolated into scripts', () => {
    const y = wf('review-draft.yml');
    expect(y).toContain('LABEL: ${{ github.event.label.name }}');
    expect(y).not.toMatch(/run:[^\n]*\$\{\{\s*github\.event/);
  });
  it('uses only the two allowed secrets', () => {
    const all = ['deploy.yml', 'instagram-sync.yml', 'review-draft.yml', 'test.yml'].map(wf).join('\n');
    const secrets = new Set([...all.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]));
    expect([...secrets].sort()).toEqual(['IG_ACCESS_TOKEN', 'IG_TOKEN_PAT']);
  });
});
