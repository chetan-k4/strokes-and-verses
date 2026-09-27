import { describe, it, expect } from 'vitest';
import { ghCli, draftIssueTitle, draftIssueBody } from '../../scripts/instagram-sync/issues';

const draft = {
  id: 'draft-123', caption: 'Pearl art next sunday evening', reasons: ['read by the local model; please check'], draftIssue: undefined,
  event: { title: 'Pearl Art Workshop', artForm: 'Pearl Art', start: '2026-10-04T17:00:00+05:30', end: null, price: null },
  sources: [{ postId: '123', permalink: 'https://www.instagram.com/p/123/', postedAt: '2026-09-25T18:00:00+05:30' }],
};

describe('ghCli', () => {
  it('creates an issue and returns its number', async () => {
    let seen: string[] = [];
    const gh = ghCli(async (args) => { seen = args; return 'https://github.com/o/r/issues/42\n'; });
    expect(await gh.createIssue('T', 'B', ['draft'])).toBe(42);
    expect(seen).toEqual(['issue', 'create', '--title', 'T', '--body', 'B', '--label', 'draft']);
  });
});

describe('draft issue text', () => {
  it('title names the workshop and date', () => expect(draftIssueTitle(draft)).toBe('Draft: Pearl Art Workshop · Sunday 4 October'));
  it('title copes with missing fields', () => expect(draftIssueTitle({ ...draft, event: {} })).toBe('Draft: new Instagram post needs a look'));
  it('body shows fields, reasons, caption, link and instructions', () => {
    const b = draftIssueBody(draft, 'https://www.instagram.com/p/123/');
    expect(b).toContain('| Date | Sunday 4 October |');
    expect(b).toContain('| Time | 5 pm |');
    expect(b).toContain('| Price | Ask for fee |');
    expect(b).toContain('read by the local model; please check');
    expect(b).toContain('```text\nPearl art next sunday evening\n```');
    expect(b).toContain('https://www.instagram.com/p/123/');
    expect(b).toContain('`publish`');
    expect(b).toContain('data/drafts/draft-123.json');
  });
  it('fences the caption so an @mention in it does not ping anyone', () => {
    const b = draftIssueBody({ ...draft, caption: 'Ping @strokesandverses to book!' }, 'https://www.instagram.com/p/123/');
    const fenceStart = b.indexOf('```text');
    expect(fenceStart).toBeGreaterThan(-1);
    const fenceEnd = b.indexOf('```', fenceStart + 3);
    const mentionIndex = b.indexOf('@strokesandverses');
    expect(mentionIndex).toBeGreaterThan(fenceStart);
    expect(mentionIndex).toBeLessThan(fenceEnd);
  });
  it('escapes a triple-backtick inside the caption so it cannot close the fence early', () => {
    const b = draftIssueBody({ ...draft, caption: 'Some text\n```\nmore text' }, 'https://www.instagram.com/p/123/');
    expect(b).toContain('more text');
    // exactly one standalone "```" line: the real closing fence. Any backticks
    // from inside the caption must have been escaped so they don't count as one.
    expect((b.match(/^```$/gm) ?? []).length).toBe(1);
  });
});
