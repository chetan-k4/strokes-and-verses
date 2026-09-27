import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchRecentMedia, refreshToken } from './instagram';
import { llmExtract } from './llm';
import { ghCli } from './issues';
import { defaultPaths, downloadImage, readState, applyChanges } from './store';
import { sync, needsLlm } from './sync';

async function main() {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error('IG_ACCESS_TOKEN is not set');
  const paths = defaultPaths();
  const media = await fetchRecentMedia(token);

  if (process.argv.includes('--plan')) {
    const needs = needsLlm(media, readState(paths).seenPostIds);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `needs_llm=${needs}\n`);
    console.log(`needs_llm=${needs}`);
    return;
  }

  const refreshed = await refreshToken(token);
  if (refreshed && refreshed !== token && process.env.RUNNER_TEMP) {
    console.log(`::add-mask::${refreshed}`);
    writeFileSync(join(process.env.RUNNER_TEMP, 'ig_token'), refreshed);
  }

  const result = await sync({
    media, now: new Date(), paths, gh: ghCli(),
    llm: (caption, postedAt) => llmExtract(caption, postedAt),
    download: (url, id) => downloadImage(paths, url, id),
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  const paths = defaultPaths();
  const state = readState(paths);
  const next = { ...state, consecutiveFailures: state.consecutiveFailures + 1 };
  applyChanges(paths, { writeEvents: [], deleteEvents: [], writeDrafts: [], deleteDrafts: [], state: next });
  if (next.consecutiveFailures === 2) {
    await ghCli().createIssue('Instagram checker is failing', `The last two runs failed.\n\nLatest error:\n\n\`\`\`\n${err instanceof Error ? err.message : String(err)}\n\`\`\`\n\nMost often the Instagram token expired: create a new one and update the \`IG_ACCESS_TOKEN\` secret.`, ['alert']).catch(() => {});
  }
  process.exit(1);
});
