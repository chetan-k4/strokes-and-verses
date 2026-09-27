import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

type Value = string | Record<string, string>;
type Token = { name: string; value: Value };
export type TokensJson = {
  color: { themes: { id: string }[]; tokens: Token[] };
  type: { families: Record<string, string> };
  spacing: { tokens: Token[] };
  radius: { tokens: Token[] };
  shadow?: { tokens: Token[] };
};

export function buildTokensCss(tokens: TokensJson): string {
  const [primary, ...others] = tokens.color.themes.map((t) => t.id);
  const pick = (t: Token, theme: string) =>
    typeof t.value === 'string' ? t.value : (t.value[theme] ?? t.value[primary]);
  const alias = (v: string) => v.replace(/^\{(.+)\}$/, 'var(--$1)');
  const themed = (theme: string) => [
    ...tokens.color.tokens.map((t) => `  --${t.name}: ${alias(pick(t, theme))};`),
    ...(tokens.shadow?.tokens ?? []).map((t) => `  --${t.name}: ${pick(t, theme)};`),
  ];
  const flat = (list: Token[]) => list.map((t) => `  --${t.name}: ${t.value};`);
  const root = [
    ...themed(primary),
    ...flat(tokens.spacing.tokens),
    ...flat(tokens.radius.tokens),
    ...Object.entries(tokens.type.families).map(([k, v]) => `  --font-${k}: ${v};`),
  ];
  let css = `/* Generated from content/brand/tokens.json by scripts/build-tokens.ts. Do not edit. */\n:root {\n${root.join('\n')}\n}\n`;
  for (const theme of others) css += `[data-theme="${theme}"] {\n${themed(theme).join('\n')}\n}\n`;
  return css;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const tokens = JSON.parse(readFileSync('content/brand/tokens.json', 'utf8'));
  writeFileSync('src/styles/tokens.css', buildTokensCss(tokens));
  console.log('wrote src/styles/tokens.css');
}
