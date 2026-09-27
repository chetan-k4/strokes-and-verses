import { readFileSync } from 'node:fs';
export type Fixture = { name: string; postId: string; postedAt: string; expected: 'live' | 'draft' | 'ignore'; caption: string };
export const fixtures: Fixture[] = JSON.parse(readFileSync('content/fixtures/instagram-captions.json', 'utf8'));
export const fixture = (name: string) => {
  const f = fixtures.find((x) => x.name === name);
  if (!f) throw new Error(`no fixture ${name}`);
  return f;
};
