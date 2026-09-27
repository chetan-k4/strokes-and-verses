import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Draft } from '../../src/lib/eventSchema';
import { formatLongDate, formatTimeRange } from '../../src/lib/eventDates';

export interface GhClient { createIssue(title: string, body: string, labels: string[]): Promise<number> }

const execFileAsync = promisify(execFile);
const defaultRun = async (args: string[]) => (await execFileAsync('gh', args)).stdout;

export function ghCli(run: (args: string[]) => Promise<string> = defaultRun): GhClient {
  return {
    async createIssue(title, body, labels) {
      const out = await run(['issue', 'create', '--title', title, '--body', body, ...labels.flatMap((l) => ['--label', l])]);
      const n = Number(out.trim().match(/\/issues\/(\d+)/)?.[1]);
      if (!n) throw new Error(`could not read issue number from gh output: ${out}`);
      return n;
    },
  };
}

export function draftIssueTitle(d: Draft): string {
  const { title, start } = d.event;
  return title && start ? `Draft: ${title} · ${formatLongDate(start)}` : 'Draft: new Instagram post needs a look';
}

export function draftIssueBody(d: Draft, permalink: string): string {
  const e = d.event;
  const row = (k: string, v: string | undefined) => `| ${k} | ${v ?? '**missing**'} |`;
  return [
    "The Instagram checker found a post it wasn't sure about.",
    '',
    '| Field | Read as |', '| --- | --- |',
    row('Workshop', e.title),
    row('Date', e.start ? formatLongDate(e.start) : undefined),
    row('Time', e.start ? formatTimeRange(e.start, e.end ?? null) : undefined),
    row('Price', e.price === undefined ? undefined : e.price === null ? 'Ask for fee' : `₹${e.price.toLocaleString('en-IN')}`),
    '',
    `**Why it's a draft:** ${d.reasons.join('; ') || "low confidence"}`,
    '',
    `**Post:** ${permalink}`,
    '',
    d.caption.split('\n').map((l) => `> ${l}`).join('\n'),
    '',
    '---',
    '**To publish:** add the `publish` label. **To drop it:** add the `discard` label.',
    `If something above is wrong or missing, edit \`data/drafts/${d.id}.json\` on GitHub first, then add \`publish\`.`,
  ].join('\n');
}
