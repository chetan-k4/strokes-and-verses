# Strokes & Verses Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static Astro site for Strokes & Verses (Home, Workshops, Classes, Learn, About, Shop) whose workshop calendar is filled automatically from Instagram twice a day, at zero running cost.

**Architecture:** Astro static site on GitHub Pages. Live events are JSON files in `src/content/events/`, validated by a zod schema. A Node/TypeScript sync script (GitHub Actions cron) fetches Instagram posts with a free Meta token, extracts events with a rule-based parser (local Ollama model as fallback, draft-only), dedupes, writes files, and opens GitHub Issues for drafts. Adding a `publish`/`discard` label on an issue runs a second workflow that moves or deletes the draft.

**Tech Stack:** Node 22, TypeScript 5, Astro 5, zod (via `astro/zod`), Vitest 3, Playwright + @axe-core/playwright, tsx, GitHub Actions/Pages/Issues, Ollama + `qwen2.5:3b-instruct` (fallback only).

**Spec:** `docs/superpowers/specs/2026-09-28-strokes-and-verses-website-design.md`

## Global Constraints

- Zero running cost. No paid services, no paid API keys. Only secrets: `IG_ACCESS_TOKEN`, `IG_TOKEN_PAT`.
- Name is always written **Strokes & Verses**. Art form spelled **Kinusaiga**.
- WhatsApp is the only phone number shown: `+91 95016 90208`, links `https://wa.me/919501690208?text=…`. Never show 99889 78334.
- Address: `1066, Sector 37-B, Chandigarh 160036`, map `https://maps.app.goo.gl/GLnZm4HAAXwFQrCx6`. Instagram `https://www.instagram.com/strokesandverses/`.
- All event times are Asia/Kolkata; ISO strings carry `+05:30`.
- Brand tokens come only from `content/brand/tokens.json` via generated `src/styles/tokens.css`. Never hard-code a colour in components.
- Neon text never on blush. `shadow-glow` at most once per page. Focus: `2px solid var(--focus-ring)`, offset 2px. Pill buttons, circular date stamps, circle photo crops.
- Script font (Sacramento) only at ≥40px, never a full sentence.
- Logos/fonts copied from `content/brand/`, never redrawn.
- Motion: ≤300ms ease-out, no bounce, nothing under `prefers-reduced-motion: reduce`.
- Every page: no horizontal scroll at 360px; axe: zero serious/critical violations.
- All internal links go through `url()` so a GitHub Pages base path works.
- Commit after each task with a message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

```
astro.config.mjs, package.json, tsconfig.json, vitest.config.ts, playwright.config.ts
scripts/
  build-tokens.ts                 tokens.json → src/styles/tokens.css
  review-draft.ts                 label handler (publish/discard)
  instagram-sync/
    artForms.ts                   alias regexes → canonical art-form names
    parse.ts                      rule-based caption → Extraction
    llm.ts                        Ollama fallback → Extraction (always low confidence)
    classify.ts                   Extraction → live | draft | ignore
    dedupe.ts                     eventId, buildEvent, dedupe
    removal.ts                    deleted-post detection
    store.ts                      read/write events, drafts, state, images
    instagram.ts                  Graph API fetch + token refresh
    issues.ts                     GitHub Issue client + draft issue body
    sync.ts                       orchestration (pure, deps injected)
    main.ts                       CLI entry wiring real deps
src/
  site.config.ts                  contact + constants
  content.config.ts               events collection
  lib/ eventSchema.ts, eventDates.ts, whatsappLink.ts, url.ts
  data/ artForms.ts, packages.ts
  assets/ art-forms/*.webp, photos/*.jpg, fonts/*.woff2, logos/*.svg
  styles/ tokens.css (generated), fonts.css, global.css
  components/ Header, Footer, Button, DateStamp, EventCard, ArtFormCard, PackageCard, WhatsAppFab, Reveal.astro
  layouts/ BaseLayout.astro
  pages/ index, workshops, classes, learn, about, shop (.astro)
  content/events/*.json           live events
data/ drafts/*.json, instagram-state.json
public/images/events/             downloaded post images
tests/ unit/*.test.ts, e2e/*.spec.ts
.github/workflows/ deploy.yml, instagram-sync.yml, review-draft.yml
```

---

### Task 1: Scaffold, brand tokens, fonts

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `scripts/build-tokens.ts`, `src/styles/tokens.css` (generated), `src/styles/fonts.css`, `src/assets/fonts/*` (copied), `src/assets/logos/*` (copied), `src/assets/art-forms/*` (copied), `src/assets/photos/*` (copied), `src/pages/index.astro` (temporary)
- Test: `tests/unit/build-tokens.test.ts`

**Interfaces:**
- Produces: `buildTokensCss(tokens: TokensJson): string`; CSS custom properties `--canvas`, `--paper`, `--blush`, `--blush-soft`, `--neon`, `--neon-glow`, `--on-neon`, `--ink`, `--ink-muted`, `--on-blush`, `--sunflower`, `--on-sunflower`, `--line`, `--line-strong`, `--focus-ring`, `--shadow-soft`, `--shadow-glow`, `--space-{1,2,3,4,6,8,12,16}`, `--radius-{sm,md,lg,pill}`, `--font-{script,serif,sans}`; theme switch via `[data-theme="neon-night"]`.

- [ ] **Step 1: Initialise the project**

```bash
npm init -y
npm i astro@^5
npm i -D typescript@^5 vitest@^3 tsx@^4 @playwright/test@^1 @axe-core/playwright@^4 @types/node@^22
mkdir -p src/assets src/styles src/pages scripts tests/unit tests/e2e
cp -R content/brand/fonts src/assets/fonts
cp -R content/brand/logos src/assets/logos
cp -R content/art-forms src/assets/art-forms
cp -R content/photos src/assets/photos
```

Replace `package.json` `scripts` and add `"type": "module"`:

```json
{
  "name": "strokes-and-verses",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "tokens": "tsx scripts/build-tokens.ts",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "sync": "tsx scripts/instagram-sync/main.ts",
    "review-draft": "tsx scripts/review-draft.ts"
  }
}
```
(Keep the `dependencies`/`devDependencies` npm wrote.)

`astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://strokesandverses.github.io',
  base: process.env.BASE_PATH ?? '/',
});
```

`tsconfig.json`:
```json
{ "extends": "astro/tsconfigs/strict", "include": [".astro/types.d.ts", "**/*"], "exclude": ["dist"] }
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/unit/**/*.test.ts'] } });
```

`.gitignore`:
```
node_modules/
dist/
.astro/
test-results/
playwright-report/
```

- [ ] **Step 2: Write the failing test** — `tests/unit/build-tokens.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildTokensCss } from '../../scripts/build-tokens';

const tokens = JSON.parse(readFileSync('content/brand/tokens.json', 'utf8'));
const css = buildTokensCss(tokens);
const block = (sel: string) => css.split(sel + ' {')[1].split('}')[0];

describe('buildTokensCss', () => {
  it('puts studio colours on :root', () => {
    expect(block(':root')).toContain('--canvas: #fbf6ef;');
    expect(block(':root')).toContain('--neon: #c2185b;');
  });
  it('puts neon-night colours on the theme selector', () => {
    const night = block('[data-theme="neon-night"]');
    expect(night).toContain('--canvas: #1c1616;');
    expect(night).toContain('--neon: #ff5ca8;');
  });
  it('resolves aliases to var()', () => {
    expect(block(':root')).toContain('--focus-ring: var(--neon);');
    expect(block('[data-theme="neon-night"]')).toContain('--focus-ring: var(--neon);');
  });
  it('emits spacing, radius, fonts and themed shadows', () => {
    const root = block(':root');
    expect(root).toContain('--space-4: 16px;');
    expect(root).toContain('--radius-pill: 999px;');
    expect(root).toContain('--font-script: Sacramento, "Brush Script MT", cursive;');
    expect(root).toContain('--shadow-glow: 0 0 0 1px rgba(194,24,91,0.20)');
    expect(block('[data-theme="neon-night"]')).toContain('--shadow-glow: 0 0 0 1px rgba(255,92,168,0.35)');
  });
  it('matches the committed tokens.css', () => {
    expect(readFileSync('src/styles/tokens.css', 'utf8')).toBe(css);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/build-tokens.test.ts`
Expected: FAIL — cannot find module `../../scripts/build-tokens`.

- [ ] **Step 4: Implement** — `scripts/build-tokens.ts`

```ts
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
```

- [ ] **Step 5: Generate tokens.css and run tests**

Run: `npm run tokens && npx vitest run tests/unit/build-tokens.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Fonts stylesheet and a temporary page**

`src/styles/fonts.css`:
```css
@font-face { font-family: 'Sacramento'; src: url('../assets/fonts/Sacramento-Regular.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Fraunces'; src: url('../assets/fonts/Fraunces-400.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Fraunces'; src: url('../assets/fonts/Fraunces-400-Italic.woff2') format('woff2'); font-weight: 400; font-style: italic; font-display: swap; }
@font-face { font-family: 'Fraunces'; src: url('../assets/fonts/Fraunces-600.woff2') format('woff2'); font-weight: 600; font-display: swap; }
@font-face { font-family: 'Bricolage Grotesque'; src: url('../assets/fonts/BricolageGrotesque-400.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Bricolage Grotesque'; src: url('../assets/fonts/BricolageGrotesque-500.woff2') format('woff2'); font-weight: 500; font-display: swap; }
@font-face { font-family: 'Bricolage Grotesque'; src: url('../assets/fonts/BricolageGrotesque-700.woff2') format('woff2'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Bricolage Grotesque'; src: url('../assets/fonts/BricolageGrotesque-800.woff2') format('woff2'); font-weight: 800; font-display: swap; }
```

`src/pages/index.astro` (temporary, replaced in Task 5):
```astro
---
import '../styles/tokens.css';
import '../styles/fonts.css';
---
<html lang="en"><body style="background:var(--canvas);color:var(--ink);font-family:var(--font-sans)"><h1 style="font-family:var(--font-serif)">Strokes &amp; Verses</h1></body></html>
```

Run: `npm run build`
Expected: build succeeds, `dist/index.html` exists.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Astro site with generated brand tokens and fonts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared libraries — dates, WhatsApp links, base URLs

**Files:**
- Create: `src/site.config.ts`, `src/lib/eventDates.ts`, `src/lib/whatsappLink.ts`, `src/lib/url.ts`
- Test: `tests/unit/eventDates.test.ts`, `tests/unit/whatsappLink.test.ts`, `tests/unit/url.test.ts`

**Interfaces:**
- Produces:
  - `istParts(iso: string): { year: number; month: number; day: number; hour: number; minute: number; weekday: string }` (weekday `'Sat'`)
  - `resolveNow(value?: string): Date`
  - `splitEvents<T extends { start: string; end: string | null }>(events: T[], now: Date): { upcoming: T[]; past: T[] }` (upcoming ascending, past descending; an event is upcoming while `end ?? start` ≥ now)
  - `formatDateStamp(iso): { weekday: string; day: string; month: string }` → `{ weekday: 'Sat', day: '19', month: 'Sept' }`
  - `formatLongDate(iso)` → `'Saturday 19 September'`; `formatShortDate(iso)` → `'Sat 19 Sept'`
  - `formatTime(iso)` → `'5:30 pm'` / `'5 pm'`; `formatTimeRange(start, end | null)` → `'5:30 to 7:30 pm'`, `'11:30 am to 1:30 pm'`, `'5:30 pm'`
  - `type BookingIntent = { kind: 'workshop'; title: string; start: string } | { kind: 'private'; artForm: string } | { kind: 'group'; artForm: string } | { kind: 'package'; name: string } | { kind: 'general' }`
  - `bookingMessage(intent): string`; `whatsappLink(intent, number = site.whatsapp): string`
  - `joinBase(base: string, path: string): string`; `url(path: string): string` (uses `import.meta.env.BASE_URL`)

- [ ] **Step 1: Write the failing tests**

`tests/unit/eventDates.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { istParts, splitEvents, formatDateStamp, formatLongDate, formatShortDate, formatTime, formatTimeRange, resolveNow } from '../../src/lib/eventDates';

describe('istParts', () => {
  it('reads wall-clock parts in IST from any offset', () => {
    expect(istParts('2026-09-19T12:00:00Z')).toEqual({ year: 2026, month: 9, day: 19, hour: 17, minute: 30, weekday: 'Sat' });
  });
});

describe('formatting', () => {
  const s = '2026-09-19T17:30:00+05:30';
  it('date stamp uses Sept, not Sep', () => expect(formatDateStamp(s)).toEqual({ weekday: 'Sat', day: '19', month: 'Sept' }));
  it('pads the day in the stamp', () => expect(formatDateStamp('2026-09-06T15:30:00+05:30').day).toBe('06'));
  it('long date', () => expect(formatLongDate(s)).toBe('Saturday 19 September'));
  it('short date', () => expect(formatShortDate(s)).toBe('Sat 19 Sept'));
  it('time', () => {
    expect(formatTime(s)).toBe('5:30 pm');
    expect(formatTime('2026-09-19T17:00:00+05:30')).toBe('5 pm');
    expect(formatTime('2026-09-19T12:15:00+05:30')).toBe('12:15 pm');
    expect(formatTime('2026-09-19T00:15:00+05:30')).toBe('12:15 am');
  });
  it('time range shares the meridiem when equal', () => {
    expect(formatTimeRange(s, '2026-09-19T19:30:00+05:30')).toBe('5:30 to 7:30 pm');
    expect(formatTimeRange('2026-09-19T11:30:00+05:30', '2026-09-19T13:30:00+05:30')).toBe('11:30 am to 1:30 pm');
    expect(formatTimeRange(s, null)).toBe('5:30 pm');
  });
});

describe('splitEvents', () => {
  const a = { id: 'a', start: '2026-09-06T15:30:00+05:30', end: '2026-09-06T17:30:00+05:30' };
  const b = { id: 'b', start: '2026-09-19T17:30:00+05:30', end: '2026-09-19T19:30:00+05:30' };
  const c = { id: 'c', start: '2026-09-20T15:30:00+05:30', end: null };
  it('splits and sorts', () => {
    const { upcoming, past } = splitEvents([c, a, b], new Date('2026-09-15T10:00:00+05:30'));
    expect(upcoming.map((e) => e.id)).toEqual(['b', 'c']);
    expect(past.map((e) => e.id)).toEqual(['a']);
  });
  it('keeps an event upcoming until it ends', () => {
    const { upcoming } = splitEvents([b], new Date('2026-09-19T18:00:00+05:30'));
    expect(upcoming).toHaveLength(1);
  });
});

describe('resolveNow', () => {
  it('uses the override when given', () => expect(resolveNow('2026-09-15T10:00:00+05:30').toISOString()).toBe('2026-09-15T04:30:00.000Z'));
  it('falls back to the real clock', () => expect(Math.abs(resolveNow().getTime() - Date.now())).toBeLessThan(1000));
});
```

`tests/unit/whatsappLink.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { bookingMessage, whatsappLink } from '../../src/lib/whatsappLink';

describe('bookingMessage', () => {
  it('workshop', () => expect(bookingMessage({ kind: 'workshop', title: 'Kinusaiga Workshop', start: '2026-09-19T17:30:00+05:30' }))
    .toBe("Hi Balpreet, I'd like to book the Kinusaiga Workshop on Sat 19 Sept, 5:30 pm."));
  it('private', () => expect(bookingMessage({ kind: 'private', artForm: 'Pearl Art' })).toBe("Hi Balpreet, I'd like to book a private Pearl Art class."));
  it('group', () => expect(bookingMessage({ kind: 'group', artForm: 'Pearl Art' })).toBe("Hi Balpreet, I'd like to plan a group Pearl Art session for ___ people."));
  it('package', () => expect(bookingMessage({ kind: 'package', name: 'Full Canvas' })).toBe("Hi Balpreet, I'm interested in the Full Canvas package."));
  it('general', () => expect(bookingMessage({ kind: 'general' })).toBe('Hi Balpreet, I have a question about Strokes & Verses.'));
});

describe('whatsappLink', () => {
  it('builds a wa.me link with the encoded message to the studio number', () => {
    const href = whatsappLink({ kind: 'general' });
    const u = new URL(href);
    expect(u.origin + u.pathname).toBe('https://wa.me/919501690208');
    expect(u.searchParams.get('text')).toBe('Hi Balpreet, I have a question about Strokes & Verses.');
  });
});
```

`tests/unit/url.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { joinBase } from '../../src/lib/url';

describe('joinBase', () => {
  it('root base', () => expect(joinBase('/', '/workshops')).toBe('/workshops'));
  it('project base', () => expect(joinBase('/sv/', 'workshops')).toBe('/sv/workshops'));
  it('home', () => expect(joinBase('/sv/', '/')).toBe('/sv/'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/eventDates.test.ts tests/unit/whatsappLink.test.ts tests/unit/url.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/site.config.ts`:
```ts
export const site = {
  name: 'Strokes & Verses',
  tagline: 'Where art meets heart',
  whatsapp: '919501690208',
  whatsappDisplay: '+91 95016 90208',
  instagramUrl: 'https://www.instagram.com/strokesandverses/',
  instagramHandle: '@strokesandverses',
  addressLines: ['1066, Sector 37-B', 'Chandigarh 160036'],
  address: '1066, Sector 37-B, Chandigarh 160036',
  mapUrl: 'https://maps.app.goo.gl/GLnZm4HAAXwFQrCx6',
  venue: 'Strokes & Verses Studio, Sector 37-B, Chandigarh',
} as const;
```

`src/lib/eventDates.ts`:
```ts
const TZ = 'Asia/Kolkata';
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LONG: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23',
});

export function istParts(iso: string) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, weekday: p.weekday };
}

export function resolveNow(value?: string): Date {
  return value ? new Date(value) : new Date();
}

export function splitEvents<T extends { start: string; end: string | null }>(events: T[], now: Date) {
  const t = now.getTime();
  const endOf = (e: T) => Date.parse(e.end ?? e.start);
  const upcoming = events.filter((e) => endOf(e) >= t).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const past = events.filter((e) => endOf(e) < t).sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  return { upcoming, past };
}

export function formatDateStamp(iso: string) {
  const p = istParts(iso);
  return { weekday: p.weekday, day: String(p.day).padStart(2, '0'), month: MONTH_SHORT[p.month - 1] };
}

export function formatLongDate(iso: string) {
  const p = istParts(iso);
  return `${WEEKDAY_LONG[p.weekday]} ${p.day} ${MONTH_LONG[p.month - 1]}`;
}

export function formatShortDate(iso: string) {
  const p = istParts(iso);
  return `${p.weekday} ${p.day} ${MONTH_SHORT[p.month - 1]}`;
}

function clock(iso: string) {
  const { hour, minute } = istParts(iso);
  const meridiem = hour < 12 ? 'am' : 'pm';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return { text: minute === 0 ? `${h}` : `${h}:${String(minute).padStart(2, '0')}`, meridiem };
}

export function formatTime(iso: string) {
  const c = clock(iso);
  return `${c.text} ${c.meridiem}`;
}

export function formatTimeRange(start: string, end: string | null) {
  if (!end) return formatTime(start);
  const a = clock(start);
  const b = clock(end);
  return a.meridiem === b.meridiem ? `${a.text} to ${b.text} ${b.meridiem}` : `${a.text} ${a.meridiem} to ${b.text} ${b.meridiem}`;
}
```

`src/lib/whatsappLink.ts`:
```ts
import { site } from '../site.config';
import { formatShortDate, formatTime } from './eventDates';

export type BookingIntent =
  | { kind: 'workshop'; title: string; start: string }
  | { kind: 'private'; artForm: string }
  | { kind: 'group'; artForm: string }
  | { kind: 'package'; name: string }
  | { kind: 'general' };

export function bookingMessage(intent: BookingIntent): string {
  switch (intent.kind) {
    case 'workshop': return `Hi Balpreet, I'd like to book the ${intent.title} on ${formatShortDate(intent.start)}, ${formatTime(intent.start)}.`;
    case 'private': return `Hi Balpreet, I'd like to book a private ${intent.artForm} class.`;
    case 'group': return `Hi Balpreet, I'd like to plan a group ${intent.artForm} session for ___ people.`;
    case 'package': return `Hi Balpreet, I'm interested in the ${intent.name} package.`;
    case 'general': return 'Hi Balpreet, I have a question about Strokes & Verses.';
  }
}

export function whatsappLink(intent: BookingIntent, number: string = site.whatsapp): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(bookingMessage(intent))}`;
}
```

`src/lib/url.ts`:
```ts
export function joinBase(base: string, path: string): string {
  const b = base.endsWith('/') ? base : base + '/';
  return b + path.replace(/^\//, '');
}

export function url(path: string): string {
  return joinBase(import.meta.env.BASE_URL ?? '/', path);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS (all tests in the three new files plus Task 1).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: IST date formatting, WhatsApp booking links, base-aware urls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Event schema, content collection, site data, seed events

**Files:**
- Create: `src/lib/eventSchema.ts`, `src/content.config.ts`, `src/data/artForms.ts`, `src/data/packages.ts`, `src/content/events/kinusaiga-2026-09-06-1530.json`, `src/content/events/kinusaiga-2026-09-19-1730.json`, `src/content/events/paper-collage-denim-pocket-frame-2026-09-20-1530.json`, `data/drafts/.gitkeep`, `data/instagram-state.json`, `public/images/events/.gitkeep`
- Test: `tests/unit/eventSchema.test.ts`, `tests/unit/siteData.test.ts`

**Interfaces:**
- Consumes: `site` (Task 2).
- Produces:
  - `SourceSchema`, `EventFieldsSchema`, `EventSchema`, `DraftSchema`, `StateSchema` (zod, from `astro/zod`)
  - `type Source = { postId: string; permalink: string; postedAt: string }`
  - `type EventFields = { title: string; artForm: string; start: string; end: string | null; price: number | null; includes: string[]; venue: string; description: string }`
  - `type Event = EventFields & { id: string; image: string | null; sources: Source[] }`
  - `type Draft = { id: string; event: Partial<EventFields>; sources: Source[]; reasons: string[]; draftIssue?: number; caption: string }`
  - `type State = { seenPostIds: string[]; lastRunAt: string | null; consecutiveFailures: number }`
  - `artForms: ArtForm[]` where `ArtForm = { slug: string; name: string; hours: number; price: number; includesNote: string; image: ImageMetadata; alt: string }`; `artFormByName(name: string): ArtForm | undefined` (case-insensitive)
  - `packages: Package[]` where `Package = { name: 'First Strokes' | 'Full Canvas'; classes: number; minutesPerClass: 60; price: number; wasPrice?: number; summary: string; points: string[] }`

- [ ] **Step 1: Write the failing tests**

`tests/unit/eventSchema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { EventSchema, DraftSchema, StateSchema } from '../../src/lib/eventSchema';

const base = {
  id: 'kinusaiga-2026-09-19-1730', title: 'Kinusaiga Workshop', artForm: 'Kinusaiga',
  start: '2026-09-19T17:30:00+05:30', end: '2026-09-19T19:30:00+05:30', price: null,
  includes: ['All materials'], venue: 'Strokes & Verses Studio, Sector 37-B, Chandigarh',
  description: 'No paint. No needle.', image: null,
  sources: [{ postId: '1', permalink: 'https://www.instagram.com/strokesandverses/', postedAt: '2026-09-12T18:00:00+05:30' }],
};

describe('EventSchema', () => {
  it('accepts a valid event', () => expect(EventSchema.parse(base)).toEqual(base));
  it('rejects a start without offset', () => expect(() => EventSchema.parse({ ...base, start: '2026-09-19T17:30:00' })).toThrow());
  it('rejects uppercase ids', () => expect(() => EventSchema.parse({ ...base, id: 'Kinusaiga' })).toThrow());
  it('requires at least one source', () => expect(() => EventSchema.parse({ ...base, sources: [] })).toThrow());
  it('validates every committed event file', () => {
    for (const f of readdirSync('src/content/events').filter((f) => f.endsWith('.json'))) {
      const data = EventSchema.parse(JSON.parse(readFileSync(`src/content/events/${f}`, 'utf8')));
      expect(`${data.id}.json`).toBe(f);
    }
  });
});

describe('DraftSchema', () => {
  it('allows partial event fields', () => {
    expect(DraftSchema.parse({ id: 'draft-9', event: { artForm: 'Pearl Art' }, sources: base.sources, reasons: ['no date'], caption: 'x' }).event.artForm).toBe('Pearl Art');
  });
});

describe('StateSchema', () => {
  it('parses the committed state file', () => {
    expect(StateSchema.parse(JSON.parse(readFileSync('data/instagram-state.json', 'utf8')))).toEqual({ seenPostIds: [], lastRunAt: null, consecutiveFailures: 0 });
  });
});
```

`tests/unit/siteData.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { artForms, artFormByName } from '../../src/data/artForms';
import { packages } from '../../src/data/packages';

describe('artForms', () => {
  it('lists the nine one-off classes with the agreed prices', () => {
    expect(artForms.map((a) => [a.name, a.hours, a.price])).toEqual([
      ['Kinusaiga', 2, 1400],
      ['Pearl Art', 2, 1399],
      ['Texture Art (Impasto)', 2, 1299],
      ['Cloth Texture Art', 3.5, 2800],
      ['Tin Embossing', 2, 1299],
      ['Boho Mirror Decoration', 2, 1299],
      ['Boho Acrylic Painting', 2, 1199],
      ['Acrylic Glass Painting', 2, 1199],
      ['Acrylic Painting', 2, 1199],
    ]);
  });
  it('finds by name case-insensitively and by short name', () => {
    expect(artFormByName('kinusaiga')?.slug).toBe('kinusaiga');
    expect(artFormByName('Texture Art')?.slug).toBe('texture-impasto');
    expect(artFormByName('Paper Collage')).toBeUndefined();
  });
});

describe('packages', () => {
  it('First Strokes and Full Canvas', () => {
    expect(packages.map((p) => [p.name, p.classes, p.price, p.wasPrice])).toEqual([
      ['First Strokes', 8, 4000, undefined],
      ['Full Canvas', 15, 7000, 7500],
    ]);
  });
});
```
(Vitest resolves `.webp` imports as asset URL strings, so no mocking is needed.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/eventSchema.test.ts tests/unit/siteData.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement schema and collection**

`src/lib/eventSchema.ts`:
```ts
import { z } from 'astro/zod';

const isoWithOffset = z.string().datetime({ offset: true });

export const SourceSchema = z.object({
  postId: z.string().min(1),
  permalink: z.string().url(),
  postedAt: isoWithOffset,
});

export const EventFieldsSchema = z.object({
  title: z.string().min(1),
  artForm: z.string().min(1),
  start: isoWithOffset,
  end: isoWithOffset.nullable(),
  price: z.number().int().positive().nullable(),
  includes: z.array(z.string()),
  venue: z.string().min(1),
  description: z.string(),
});

export const EventSchema = EventFieldsSchema.extend({
  id: z.string().regex(/^[a-z0-9-]+$/),
  image: z.string().nullable(),
  sources: z.array(SourceSchema).min(1),
});

export const DraftSchema = z.object({
  id: z.string().regex(/^draft-[A-Za-z0-9_-]+$/),
  event: EventFieldsSchema.partial(),
  sources: z.array(SourceSchema).min(1),
  reasons: z.array(z.string()),
  draftIssue: z.number().int().positive().optional(),
  caption: z.string(),
});

export const StateSchema = z.object({
  seenPostIds: z.array(z.string()),
  lastRunAt: isoWithOffset.nullable(),
  consecutiveFailures: z.number().int().min(0),
});

export type Source = z.infer<typeof SourceSchema>;
export type EventFields = z.infer<typeof EventFieldsSchema>;
export type Event = z.infer<typeof EventSchema>;
export type Draft = z.infer<typeof DraftSchema>;
export type State = z.infer<typeof StateSchema>;
```

`src/content.config.ts`:
```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { EventSchema } from './lib/eventSchema';

export const collections = {
  events: defineCollection({
    loader: glob({ pattern: '*.json', base: './src/content/events' }),
    schema: EventSchema,
  }),
};
```

- [ ] **Step 4: Implement site data**

`src/data/artForms.ts`:
```ts
import type { ImageMetadata } from 'astro';
import kinusaiga from '../assets/art-forms/kinusaiga.webp';
import pearl from '../assets/art-forms/pearl-art.webp';
import texture from '../assets/art-forms/texture-impasto.webp';
import cloth from '../assets/art-forms/cloth-texture.webp';
import tin from '../assets/art-forms/tin-embossing.webp';
import mirror from '../assets/art-forms/boho-mirror.webp';
import boho from '../assets/art-forms/boho-acrylic.webp';
import glass from '../assets/art-forms/acrylic-glass.webp';
import acrylic from '../assets/art-forms/acrylic-painting.webp';

export type ArtForm = { slug: string; name: string; shortName: string; hours: number; price: number; includesNote: string; image: ImageMetadata; alt: string };

export const artForms: ArtForm[] = [
  { slug: 'kinusaiga', name: 'Kinusaiga', shortName: 'Kinusaiga', hours: 2, price: 1400, includesNote: 'Materials and frame included', image: kinusaiga, alt: 'A framed Kinusaiga fabric mosaic portrait held up in front of the neon Strokes & Verses sign' },
  { slug: 'pearl-art', name: 'Pearl Art', shortName: 'Pearl Art', hours: 2, price: 1399, includesNote: 'Materials included · one complete painting', image: pearl, alt: 'Three pearl art seascapes with sunset skies, held up in the studio' },
  { slug: 'texture-impasto', name: 'Texture Art (Impasto)', shortName: 'Texture Art', hours: 2, price: 1299, includesNote: 'Materials included', image: texture, alt: 'Thick impasto sunflowers on a square canvas on a wooden shelf' },
  { slug: 'cloth-texture', name: 'Cloth Texture Art', shortName: 'Cloth Texture Art', hours: 3.5, price: 2800, includesNote: 'Materials included', image: cloth, alt: 'A textured canvas with draped cloth in peach holding a bunch of yellow flowers' },
  { slug: 'tin-embossing', name: 'Tin Embossing', shortName: 'Tin Embossing', hours: 2, price: 1299, includesNote: 'Materials included', image: tin, alt: 'Embossed silver tin moon, horse, leaf and fish on a blue painted board' },
  { slug: 'boho-mirror', name: 'Boho Mirror Decoration', shortName: 'Boho Mirror', hours: 2, price: 1299, includesNote: 'Materials included', image: mirror, alt: 'A round jute rope mirror decorated with pearls and shells on the studio wall' },
  { slug: 'boho-acrylic', name: 'Boho Acrylic Painting', shortName: 'Boho Acrylic', hours: 2, price: 1199, includesNote: 'Materials included', image: boho, alt: 'A boho line-art face among tropical leaves in green, coral and pink' },
  { slug: 'acrylic-glass', name: 'Acrylic Glass Painting', shortName: 'Glass Painting', hours: 2, price: 1199, includesNote: 'Materials included', image: glass, alt: 'A glass painting of a yellow crescent moon and pink flowers held against the sky' },
  { slug: 'acrylic-painting', name: 'Acrylic Painting', shortName: 'Acrylic Painting', hours: 2, price: 1199, includesNote: 'Materials included', image: acrylic, alt: 'An acrylic painting of a blue arched door under pink bougainvillea' },
];

export function artFormByName(name: string): ArtForm | undefined {
  const n = name.trim().toLowerCase();
  return artForms.find((a) => a.name.toLowerCase() === n || a.shortName.toLowerCase() === n);
}
```

`src/data/packages.ts`:
```ts
export type Package = { name: 'First Strokes' | 'Full Canvas'; classes: number; minutesPerClass: 60; price: number; wasPrice?: number; summary: string; points: string[] };

export const packages: Package[] = [
  {
    name: 'First Strokes', classes: 8, minutesPerClass: 60, price: 4000,
    summary: 'Small artworks to learn the basics, one skill at a time.',
    points: ['Drawing and sketching', 'Acrylic and watercolour basics', 'A small practice artwork most classes'],
  },
  {
    name: 'Full Canvas', classes: 15, minutesPerClass: 60, price: 7000, wasPrice: 7500,
    summary: 'Take a larger canvas from first sketch to finished piece, under Balpreet’s supervision.',
    points: ['Everything in First Strokes', 'One larger canvas project, start to finish', 'Guided composition, colour and finishing'],
  },
];
```

- [ ] **Step 5: Seed events and state**

`data/instagram-state.json`:
```json
{ "seenPostIds": [], "lastRunAt": null, "consecutiveFailures": 0 }
```
Create empty `data/drafts/.gitkeep` and `public/images/events/.gitkeep`.

`src/content/events/kinusaiga-2026-09-06-1530.json`:
```json
{
  "id": "kinusaiga-2026-09-06-1530",
  "title": "Kinusaiga Workshop",
  "artForm": "Kinusaiga",
  "start": "2026-09-06T15:30:00+05:30",
  "end": "2026-09-06T17:30:00+05:30",
  "price": null,
  "includes": ["All materials", "Frame", "Refreshments"],
  "venue": "Strokes & Verses Studio, Sector 37-B, Chandigarh",
  "description": "Create a beautiful Japanese Fabric Art piece with no paint, no brush, no stitching - just fabric Frame Your Own Art",
  "image": null,
  "sources": [
    { "postId": "fixture-kinusaiga-6sept-details", "permalink": "https://www.instagram.com/strokesandverses/", "postedAt": "2026-08-28T18:00:00+05:30" },
    { "postId": "fixture-kinusaiga-6sept-labelled", "permalink": "https://www.instagram.com/strokesandverses/", "postedAt": "2026-08-30T18:00:00+05:30" }
  ]
}
```

`src/content/events/kinusaiga-2026-09-19-1730.json`:
```json
{
  "id": "kinusaiga-2026-09-19-1730",
  "title": "Kinusaiga Workshop",
  "artForm": "Kinusaiga",
  "start": "2026-09-19T17:30:00+05:30",
  "end": "2026-09-19T19:30:00+05:30",
  "price": null,
  "includes": ["All materials"],
  "venue": "Strokes & Verses Studio, Sector 37-B, Chandigarh",
  "description": "No paint. No needle. Just tiny fabric scraps tucked into grooves to create a beautiful mosaic picture. Slow, meditative & super satisfying!",
  "image": null,
  "sources": [
    { "postId": "fixture-kinusaiga-19sept-b", "permalink": "https://www.instagram.com/strokesandverses/", "postedAt": "2026-09-11T18:00:00+05:30" },
    { "postId": "fixture-kinusaiga-19sept-a", "permalink": "https://www.instagram.com/strokesandverses/", "postedAt": "2026-09-12T18:00:00+05:30" }
  ]
}
```

`src/content/events/paper-collage-denim-pocket-frame-2026-09-20-1530.json`:
```json
{
  "id": "paper-collage-denim-pocket-frame-2026-09-20-1530",
  "title": "Paper Collage & Denim Pocket Frame Workshop",
  "artForm": "Paper Collage & Denim Pocket Frame",
  "start": "2026-09-20T15:30:00+05:30",
  "end": "2026-09-20T17:30:00+05:30",
  "price": null,
  "includes": ["All materials", "Refreshments"],
  "venue": "Strokes & Verses Studio, Sector 37-B, Chandigarh",
  "description": "We're tearing paper to build mountains or collage of your choice & along with that we turning old denim pockets into art that actually holds memories.",
  "image": null,
  "sources": [
    { "postId": "fixture-double-art-20sept-b", "permalink": "https://www.instagram.com/strokesandverses/", "postedAt": "2026-09-12T12:00:00+05:30" },
    { "postId": "fixture-double-art-20sept-a", "permalink": "https://www.instagram.com/strokesandverses/", "postedAt": "2026-09-13T18:00:00+05:30" }
  ]
}
```
(These seeds must equal what the sync produces from the fixtures; Task 12 asserts it and may adjust `description` strings to the parser's exact output.)

- [ ] **Step 6: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: all unit tests PASS; build succeeds (Astro syncs the `events` collection without schema errors).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: event schema, content collection, art forms, packages, seed events

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Base layout, shared components, Playwright harness

**Files:**
- Create: `src/styles/global.css`, `src/layouts/BaseLayout.astro`, `src/components/Header.astro`, `src/components/Footer.astro`, `src/components/Button.astro`, `src/components/DateStamp.astro`, `src/components/WhatsAppFab.astro`, `playwright.config.ts`, `tests/e2e/helpers.ts`, `tests/e2e/layout.spec.ts`
- Modify: `src/pages/index.astro` (use BaseLayout with a placeholder `<h1>`)

**Interfaces:**
- Consumes: `site`, `url`, `whatsappLink`, `formatDateStamp`.
- Produces:
  - `<BaseLayout title: string; description: string; theme?: 'studio' | 'neon-night'>` with slot; renders skip link, Header, `<main id="main">`, Footer, WhatsAppFab.
  - `<Button href: string; variant?: 'primary' | 'outline' | 'sun'; glow?: boolean; external?: boolean; testId?: string>` slot = label. Renders `<a class="sv-btn sv-btn--{variant}">`; `external` adds `target="_blank" rel="noopener"`.
  - `<DateStamp iso: string; size?: 'md' | 'sm'>`
  - Playwright helper `expectWhatsApp(locator, expectedText)`, `expectNoHorizontalScroll(page)`, `checkA11y(page)`.
  - Nav items (in order): Workshops `/workshops`, Classes `/classes`, Learn `/learn`, About `/about`, Shop `/shop`.

- [ ] **Step 1: Playwright config and helpers**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export const FROZEN_NOW = '2026-09-15T10:00:00+05:30';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4321' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 780 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: `SV_NOW=${FROZEN_NOW} npm run build && npm run preview -- --port 4321`,
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

`tests/e2e/helpers.ts`:
```ts
import { expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FROZEN_NOW } from '../../playwright.config';

export async function freezeClock(page: Page) {
  await page.clock.setFixedTime(new Date(FROZEN_NOW));
}

export async function expectWhatsApp(link: Locator, text: string) {
  const href = await link.getAttribute('href');
  expect(href).not.toBeNull();
  const u = new URL(href!);
  expect(u.origin + u.pathname).toBe('https://wa.me/919501690208');
  expect(u.searchParams.get('text')).toBe(text);
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

export async function checkA11y(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes.map((n) => n.target)]), null, 2)).toEqual([]);
}
```

- [ ] **Step 2: Write the failing e2e test** — `tests/e2e/layout.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import { expectWhatsApp, expectNoHorizontalScroll } from './helpers';

test('header navigation lists every page', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const name of ['Workshops', 'Classes', 'Learn', 'About', 'Shop']) {
    await expect(nav.getByRole('link', { name })).toBeVisible();
  }
});

test('mobile menu toggles aria-expanded', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await page.goto('/');
  const btn = page.getByRole('button', { name: 'Menu' });
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
});

test('footer has address, map, WhatsApp and Instagram', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText('1066, Sector 37-B');
  await expect(footer.getByRole('link', { name: /map/i })).toHaveAttribute('href', 'https://maps.app.goo.gl/GLnZm4HAAXwFQrCx6');
  await expect(footer.getByRole('link', { name: /instagram/i })).toHaveAttribute('href', 'https://www.instagram.com/strokesandverses/');
  await expectWhatsApp(footer.getByRole('link', { name: /whatsapp/i }), 'Hi Balpreet, I have a question about Strokes & Verses.');
  await expect(page.locator('body')).not.toContainText('9988978334');
  await expect(page.locator('body')).not.toContainText('99889');
});

test('skip link targets main', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveAttribute('href', '#main');
});

test('no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  await expectNoHorizontalScroll(page);
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx playwright install chromium && npx playwright test tests/e2e/layout.spec.ts`
Expected: FAIL — no navigation/footer.

- [ ] **Step 4: Implement global styles** — `src/styles/global.css`

```css
@import './tokens.css';
@import './fonts.css';

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--canvas); color: var(--ink); font: 400 16px/24px var(--font-sans); }
img { max-width: 100%; height: auto; display: block; }
a { color: var(--neon); }
:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
[data-theme] { background: var(--canvas); color: var(--ink); }

.container { width: min(1120px, 100% - 32px); margin-inline: auto; }
.section { padding-block: var(--space-12); }
@media (min-width: 768px) { .section { padding-block: var(--space-16); } }

.label { font: 700 12px/16px var(--font-sans); letter-spacing: .16em; text-transform: uppercase; color: var(--ink-muted); margin: 0 0 var(--space-2); }
.display { font: 600 clamp(34px, 7vw, 48px)/1.08 var(--font-serif); letter-spacing: -.01em; margin: 0; }
.headline { font: 600 clamp(26px, 4.5vw, 32px)/1.2 var(--font-serif); margin: 0 0 var(--space-4); }
.title-italic { font: italic 400 clamp(19px, 3vw, 22px)/1.3 var(--font-serif); color: var(--ink-muted); margin: var(--space-3) 0 0; }
.script { font: 400 clamp(48px, 10vw, 64px)/1 var(--font-script); color: var(--neon); }
.muted { color: var(--ink-muted); }
.small { font-size: 13px; line-height: 18px; }

.skip-link { position: absolute; left: var(--space-4); top: -100px; z-index: 100; background: var(--paper); color: var(--ink); padding: var(--space-2) var(--space-4); border-radius: var(--radius-pill); }
.skip-link:focus { top: var(--space-4); }

/* Button (from the design system bundle) */
.sv-btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: 44px; font: 700 15px/20px var(--font-sans); padding: var(--space-3) var(--space-6); border-radius: var(--radius-pill); border: 2px solid transparent; cursor: pointer; text-decoration: none; transition: transform 160ms ease-out, background-color 160ms ease-out; }
.sv-btn:active { transform: scale(0.97); }
.sv-btn--primary { background: var(--neon); color: var(--on-neon); }
.sv-btn--primary.is-glow { box-shadow: var(--shadow-glow); }
.sv-btn--outline { background: transparent; color: var(--ink); border-color: var(--line-strong); }
.sv-btn--sun { background: var(--sunflower); color: var(--on-sunflower); }

/* Chip */
.sv-chip { display: inline-flex; align-items: center; font: 700 12px/16px var(--font-sans); letter-spacing: .08em; text-transform: uppercase; padding: 6px var(--space-3); border-radius: var(--radius-pill); background: var(--blush-soft); color: var(--ink); }
.sv-chip--sun { background: var(--sunflower); color: var(--on-sunflower); }
.chips { display: flex; flex-wrap: wrap; gap: var(--space-2); padding: 0; margin: 0; list-style: none; }

/* Date stamp */
.sv-stamp { flex: none; width: 88px; height: 88px; border-radius: var(--radius-pill); background: var(--neon); color: var(--on-neon); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.sv-stamp b { font: 600 34px/32px var(--font-serif); }
.sv-stamp span { font: 700 10px/13px var(--font-sans); letter-spacing: .16em; text-transform: uppercase; }
.sv-stamp--sm { width: 64px; height: 64px; }
.sv-stamp--sm b { font-size: 24px; line-height: 24px; }

/* Cards */
.card { background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius-md); overflow: hidden; }
.grid { display: grid; gap: var(--space-6); }
@media (min-width: 640px) { .grid--2 { grid-template-columns: repeat(2, 1fr); } .grid--3 { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 960px) { .grid--3 { grid-template-columns: repeat(3, 1fr); } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 5: Implement components**

`src/components/Button.astro`:
```astro
---
interface Props { href: string; variant?: 'primary' | 'outline' | 'sun'; glow?: boolean; external?: boolean; testId?: string; class?: string }
const { href, variant = 'primary', glow = false, external = false, testId, class: extra = '' } = Astro.props;
---
<a
  class:list={['sv-btn', `sv-btn--${variant}`, { 'is-glow': glow }, extra]}
  href={href}
  data-testid={testId}
  {...(external ? { target: '_blank', rel: 'noopener' } : {})}
><slot /></a>
```

`src/components/DateStamp.astro`:
```astro
---
import { formatDateStamp, formatLongDate } from '../lib/eventDates';
interface Props { iso: string; size?: 'md' | 'sm' }
const { iso, size = 'md' } = Astro.props;
const s = formatDateStamp(iso);
---
<div class:list={['sv-stamp', { 'sv-stamp--sm': size === 'sm' }]} role="img" aria-label={formatLongDate(iso)}>
  <span aria-hidden="true">{s.weekday}</span><b aria-hidden="true">{s.day}</b><span aria-hidden="true">{s.month}</span>
</div>
```

`src/components/Header.astro`:
```astro
---
import { url } from '../lib/url';
import wordmark from '../assets/logos/sv-wordmark-neon.svg';
import wordmarkCream from '../assets/logos/sv-wordmark-cream.svg';
interface Props { theme: 'studio' | 'neon-night' }
const { theme } = Astro.props;
const items = [
  ['Workshops', '/workshops'], ['Classes', '/classes'], ['Learn', '/learn'], ['About', '/about'], ['Shop', '/shop'],
] as const;
const current = Astro.url.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), '') || '/';
const logo = theme === 'neon-night' ? wordmarkCream : wordmark;
---
<header class="site-header" data-theme={theme === 'neon-night' ? 'neon-night' : undefined}>
  <div class="container bar">
    <a href={url('/')} class="brand" aria-label="Strokes & Verses home">
      <img src={logo.src} alt="" width="168" height="48" />
    </a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="main-nav">Menu</button>
    <nav id="main-nav" aria-label="Main">
      <ul>
        {items.map(([label, href]) => (
          <li><a href={url(href)} aria-current={current.startsWith(href) ? 'page' : undefined}>{label}</a></li>
        ))}
      </ul>
    </nav>
  </div>
</header>

<style>
  .site-header { position: relative; z-index: 20; border-bottom: 1px solid var(--line); }
  .bar { display: flex; align-items: center; justify-content: space-between; min-height: 72px; gap: var(--space-4); }
  .brand img { width: 168px; height: auto; }
  .menu-btn { font: 700 14px/20px var(--font-sans); color: var(--ink); background: transparent; border: 2px solid var(--line-strong); border-radius: var(--radius-pill); padding: var(--space-2) var(--space-4); min-height: 44px; cursor: pointer; }
  nav ul { list-style: none; margin: 0; padding: 0; }
  nav a { color: var(--ink); text-decoration: none; font-weight: 500; display: block; padding: var(--space-3) 0; }
  nav a[aria-current='page'] { color: var(--neon); }
  @media (max-width: 767px) {
    nav { display: none; position: absolute; inset: 100% 0 auto 0; background: var(--canvas); border-bottom: 1px solid var(--line); padding: var(--space-2) var(--space-4) var(--space-4); }
    nav.open { display: block; }
    nav a { font-size: 20px; padding: var(--space-3) 0; }
  }
  @media (min-width: 768px) {
    .menu-btn { display: none; }
    nav ul { display: flex; gap: var(--space-6); }
  }
</style>

<script>
  const btn = document.querySelector<HTMLButtonElement>('.menu-btn');
  const nav = document.getElementById('main-nav');
  const set = (open: boolean) => { btn?.setAttribute('aria-expanded', String(open)); nav?.classList.toggle('open', open); };
  btn?.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && btn?.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); } });
</script>
```

`src/components/Footer.astro`:
```astro
---
import { site } from '../site.config';
import { url } from '../lib/url';
import { whatsappLink } from '../lib/whatsappLink';
import monogram from '../assets/logos/sv-monogram-neon.svg';
---
<footer class="site-footer" data-theme="neon-night">
  <div class="container cols">
    <div>
      <img src={monogram.src} alt="" width="64" height="64" />
      <p class="small muted">Strokes &amp; Verses Studio · by Balpreet Kaur</p>
    </div>
    <address>
      <p class="label">Visit</p>
      {site.addressLines.map((l) => <span>{l}<br /></span>)}
      <a href={site.mapUrl} target="_blank" rel="noopener">Open in Google Maps</a>
    </address>
    <div>
      <p class="label">Say hello</p>
      <a href={whatsappLink({ kind: 'general' })} target="_blank" rel="noopener">WhatsApp {site.whatsappDisplay}</a><br />
      <a href={site.instagramUrl} target="_blank" rel="noopener">Instagram {site.instagramHandle}</a>
    </div>
    <div>
      <p class="label">Explore</p>
      <a href={url('/workshops')}>Workshops</a><br /><a href={url('/classes')}>Classes</a><br /><a href={url('/learn')}>Learn</a>
    </div>
  </div>
  <p class="container small muted tag">#StrokesAndVerses</p>
</footer>

<style>
  .site-footer { padding-block: var(--space-12) var(--space-16); margin-top: var(--space-12); }
  .cols { display: grid; gap: var(--space-8); }
  @media (min-width: 768px) { .cols { grid-template-columns: 1.2fr 1fr 1fr 1fr; } }
  address { font-style: normal; }
  a { color: var(--ink); line-height: 32px; }
  .tag { margin-top: var(--space-8); }
</style>
```

`src/components/WhatsAppFab.astro`:
```astro
---
import { whatsappLink } from '../lib/whatsappLink';
---
<a class="fab" href={whatsappLink({ kind: 'general' })} target="_blank" rel="noopener" aria-label="Chat on WhatsApp" data-testid="whatsapp-fab">
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>
</a>
<style>
  .fab { position: fixed; right: var(--space-4); bottom: var(--space-4); z-index: 30; width: 56px; height: 56px; border-radius: var(--radius-pill); background: var(--neon); color: var(--on-neon); display: grid; place-items: center; box-shadow: var(--shadow-soft); transition: transform 160ms ease-out; }
  .fab:active { transform: scale(0.95); }
  @media (min-width: 768px) { .fab { display: none; } }
</style>
```

`src/layouts/BaseLayout.astro`:
```astro
---
import '../styles/global.css';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import WhatsAppFab from '../components/WhatsAppFab.astro';
import monogram from '../assets/logos/sv-monogram-neon.svg';
interface Props { title: string; description: string; theme?: 'studio' | 'neon-night' }
const { title, description, theme = 'studio' } = Astro.props;
const fullTitle = title === 'Strokes & Verses' ? 'Strokes & Verses · Art studio in Chandigarh' : `${title} · Strokes & Verses`;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    <meta name="description" content={description} />
    <link rel="icon" href={monogram.src} type="image/svg+xml" />
    <meta property="og:title" content={fullTitle} />
    <meta property="og:description" content={description} />
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <Header theme={theme} />
    <main id="main" tabindex="-1"><slot /></main>
    <Footer />
    <WhatsAppFab />
  </body>
</html>
```

`src/pages/index.astro` (still a placeholder until Task 5):
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="Strokes & Verses" description="Art workshops and classes by Balpreet Kaur in Sector 37-B, Chandigarh.">
  <section class="section container"><h1 class="display">Strokes &amp; Verses</h1></section>
</BaseLayout>
```

Create stub pages so nav links don't 404 (replaced in Tasks 5–6) — `src/pages/{workshops,classes,learn,about,shop}.astro`, each:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="Coming together" description="Strokes & Verses"><section class="section container"><h1 class="display">Coming together</h1></section></BaseLayout>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx playwright test tests/e2e/layout.spec.ts`
Expected: PASS on `mobile` and `desktop` projects.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: base layout, header with mobile menu, footer, buttons, date stamp, e2e harness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Event card, Home page, Workshops page

**Files:**
- Create: `src/components/EventCard.astro`, `src/components/UpcomingGuard.astro`, `src/lib/events.ts`
- Modify: `src/pages/index.astro`, `src/pages/workshops.astro`
- Test: `tests/e2e/home.spec.ts`, `tests/e2e/workshops.spec.ts`

**Interfaces:**
- Consumes: `getCollection('events')`, `splitEvents`, `resolveNow`, `artFormByName`, `whatsappLink`, `DateStamp`, `Button`, `formatLongDate`, `formatTimeRange`.
- Produces:
  - `loadEvents(): Promise<{ upcoming: Event[]; past: Event[] }>` in `src/lib/events.ts` (uses `process.env.SV_NOW` at build time)
  - `<EventCard event: Event; compact?: boolean>`: `<article data-testid="event-card" data-end={end ?? start}>` with image (event.image → art-form image → blossom panel), DateStamp, title, time range, price (`₹1,400` or `Ask for fee`), includes chips, and a "Book on WhatsApp" Button (`testId="book-event"`). `compact` hides description and includes.
  - `<UpcomingGuard />`: inline script hiding `[data-testid="event-card"][data-upcoming]` whose `data-end` is before `Date.now()`, and revealing `[data-empty-upcoming]` when none remain.

- [ ] **Step 1: Write the failing e2e tests**

`tests/e2e/workshops.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { freezeClock, expectWhatsApp, expectNoHorizontalScroll, checkA11y } from './helpers';

test.beforeEach(async ({ page }) => { await freezeClock(page); await page.goto('/workshops'); });

test('lists upcoming workshops in date order (build frozen at 15 Sept 2026)', async ({ page }) => {
  const upcoming = page.getByTestId('upcoming').getByTestId('event-card');
  await expect(upcoming).toHaveCount(2);
  await expect(upcoming.nth(0)).toContainText('Kinusaiga Workshop');
  await expect(upcoming.nth(0)).toContainText('Saturday 19 September');
  await expect(upcoming.nth(0)).toContainText('5:30 to 7:30 pm');
  await expect(upcoming.nth(0)).toContainText('Ask for fee');
  await expect(upcoming.nth(1)).toContainText('Paper Collage & Denim Pocket Frame Workshop');
});

test('book button opens WhatsApp with the workshop and date', async ({ page }) => {
  const first = page.getByTestId('upcoming').getByTestId('event-card').first();
  await expectWhatsApp(first.getByTestId('book-event'), "Hi Balpreet, I'd like to book the Kinusaiga Workshop on Sat 19 Sept, 5:30 pm.");
});

test('past workshops appear under Recently', async ({ page }) => {
  const past = page.getByTestId('recent').getByTestId('event-card');
  await expect(past).toHaveCount(1);
  await expect(past.first()).toContainText('Kinusaiga Workshop');
  await expect(past.first().getByTestId('book-event')).toHaveCount(0);
});

test('client guard hides workshops that ended after the build', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-19T20:00:00+05:30'));
  await page.reload();
  await expect(page.getByTestId('upcoming').getByTestId('event-card').filter({ visible: true })).toHaveCount(1);
});

test('empty state appears when nothing is upcoming', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-01T10:00:00+05:30'));
  await page.reload();
  await expect(page.getByText('New workshops are announced on Instagram first')).toBeVisible();
});

test('layout and accessibility', async ({ page }) => {
  await expectNoHorizontalScroll(page);
  await checkA11y(page);
});
```

`tests/e2e/home.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { freezeClock, expectWhatsApp, expectNoHorizontalScroll, checkA11y } from './helpers';

test.beforeEach(async ({ page }) => { await freezeClock(page); await page.goto('/'); });

test('hero shows the brand and tagline', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(/Strokes & Verses/);
  await expect(page.getByText('Where art meets heart')).toBeVisible();
});

test('shows up to three upcoming workshops', async ({ page }) => {
  const cards = page.getByTestId('home-upcoming').getByTestId('event-card');
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'See all workshops' })).toHaveAttribute('href', /\/workshops$/);
});

test('three ways to learn link to their pages', async ({ page }) => {
  const ways = page.getByTestId('ways');
  await expect(ways.getByRole('link', { name: /Workshops/ })).toHaveAttribute('href', /\/workshops$/);
  await expect(ways.getByRole('link', { name: /One-off classes/ })).toHaveAttribute('href', /\/classes$/);
  await expect(ways.getByRole('link', { name: /Learner packages/ })).toHaveAttribute('href', /\/learn$/);
});

test('features the Hardy Sandhu sip & paint', async ({ page }) => {
  await expect(page.getByTestId('loved-by')).toContainText('Hardy Sandhu');
});

test('founder intro links to About', async ({ page }) => {
  await expect(page.getByTestId('founder').getByRole('link', { name: /Balpreet/ })).toHaveAttribute('href', /\/about$/);
});

test('primary CTA opens WhatsApp', async ({ page }) => {
  await expectWhatsApp(page.getByTestId('hero-cta'), 'Hi Balpreet, I have a question about Strokes & Verses.');
});

test('layout and accessibility', async ({ page }) => {
  await expectNoHorizontalScroll(page);
  await checkA11y(page);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test tests/e2e/home.spec.ts tests/e2e/workshops.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement event loading and card**

`src/lib/events.ts`:
```ts
import { getCollection } from 'astro:content';
import type { Event } from './eventSchema';
import { resolveNow, splitEvents } from './eventDates';

export async function loadEvents(): Promise<{ upcoming: Event[]; past: Event[] }> {
  const entries = await getCollection('events');
  return splitEvents(entries.map((e) => e.data as Event), resolveNow(process.env.SV_NOW));
}
```

`src/components/EventCard.astro`:
```astro
---
import { Image } from 'astro:assets';
import type { Event } from '../lib/eventSchema';
import DateStamp from './DateStamp.astro';
import Button from './Button.astro';
import { artFormByName } from '../data/artForms';
import { formatLongDate, formatTimeRange } from '../lib/eventDates';
import { whatsappLink } from '../lib/whatsappLink';
import { url } from '../lib/url';
import blossom from '../assets/logos/sv-blossom-neon.svg';

interface Props { event: Event; compact?: boolean; upcoming?: boolean }
const { event, compact = false, upcoming = true } = Astro.props;
const artForm = artFormByName(event.artForm);
const price = event.price === null ? 'Ask for fee' : `₹${event.price.toLocaleString('en-IN')}`;
---
<article class="card event" data-testid="event-card" data-end={event.end ?? event.start} data-upcoming={upcoming ? '' : undefined}>
  <div class="media">
    {event.image ? <img src={url(event.image)} alt="" loading="lazy" width="640" height="640" />
      : artForm ? <Image src={artForm.image} alt="" widths={[360, 640]} sizes="(min-width: 960px) 360px, 100vw" />
      : <div class="placeholder"><img src={blossom.src} alt="" width="72" height="72" /></div>}
    <div class="stamp"><DateStamp iso={event.start} size={compact ? 'sm' : 'md'} /></div>
  </div>
  <div class="body">
    <h3 class="title">{event.title}</h3>
    <p class="when"><span>{formatLongDate(event.start)}</span> · <span>{formatTimeRange(event.start, event.end)}</span></p>
    <p class="price">{price}</p>
    {!compact && event.description && <p class="muted desc">{event.description}</p>}
    {!compact && event.includes.length > 0 && <ul class="chips">{event.includes.map((i) => <li class="sv-chip">{i}</li>)}</ul>}
    {upcoming && <Button href={whatsappLink({ kind: 'workshop', title: event.title, start: event.start })} external testId="book-event">Book on WhatsApp</Button>}
  </div>
</article>

<style>
  .event { display: flex; flex-direction: column; }
  .media { position: relative; aspect-ratio: 4 / 3; background: var(--blush-soft); }
  .media > :global(img) { width: 100%; height: 100%; object-fit: cover; }
  .placeholder { width: 100%; height: 100%; display: grid; place-items: center; }
  .stamp { position: absolute; left: var(--space-4); bottom: calc(-1 * var(--space-6)); }
  .body { padding: var(--space-8) var(--space-6) var(--space-6); display: grid; gap: var(--space-2); justify-items: start; }
  .title { font: 600 22px/28px var(--font-serif); margin: 0; }
  .when { margin: 0; font-weight: 700; }
  .price { margin: 0; color: var(--ink-muted); }
  .desc { margin: 0; }
  .chips { margin-block: var(--space-2); }
</style>
```

`src/components/UpcomingGuard.astro`:
```astro
<script>
  const now = Date.now();
  document.querySelectorAll<HTMLElement>('[data-testid="event-card"][data-upcoming]').forEach((card) => {
    if (Date.parse(card.dataset.end ?? '') < now) card.hidden = true;
  });
  document.querySelectorAll<HTMLElement>('[data-upcoming-list]').forEach((list) => {
    const visible = list.querySelectorAll('[data-testid="event-card"]:not([hidden])').length;
    const empty = list.parentElement?.querySelector<HTMLElement>('[data-empty-upcoming]');
    if (empty) empty.hidden = visible > 0;
  });
</script>
```

- [ ] **Step 4: Implement the Workshops page** — `src/pages/workshops.astro`

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import EventCard from '../components/EventCard.astro';
import UpcomingGuard from '../components/UpcomingGuard.astro';
import Button from '../components/Button.astro';
import { loadEvents } from '../lib/events';
import { site } from '../site.config';
const { upcoming, past } = await loadEvents();
const recent = past.slice(0, 6);
---
<BaseLayout title="Workshops" description="Upcoming art workshops at Strokes & Verses, Sector 37-B, Chandigarh. All materials included, beginner friendly.">
  <section class="section container">
    <p class="label">Workshop calendar</p>
    <h1 class="display">Come make something this week</h1>
    <p class="title-italic">Beginner friendly. All materials included.</p>
  </section>

  <section class="container" data-testid="upcoming" aria-labelledby="upcoming-h">
    <h2 id="upcoming-h" class="headline">Upcoming</h2>
    <div class="grid grid--3" data-upcoming-list>
      {upcoming.map((e) => <EventCard event={e} />)}
    </div>
    <div class="card empty" data-empty-upcoming hidden={upcoming.length > 0}>
      <p class="headline">New workshops are announced on Instagram first</p>
      <p class="muted">Follow along and you’ll hear the moment the next one opens.</p>
      <Button href={site.instagramUrl} variant="outline" external>Follow {site.instagramHandle}</Button>
    </div>
  </section>

  {recent.length > 0 && (
    <section class="section container" data-testid="recent" aria-labelledby="recent-h">
      <h2 id="recent-h" class="headline">Recently at the studio</h2>
      <div class="grid grid--3 recent">
        {recent.map((e) => <EventCard event={e} compact upcoming={false} />)}
      </div>
    </section>
  )}
  <UpcomingGuard />
</BaseLayout>

<style>
  .empty { padding: var(--space-8) var(--space-6); display: grid; gap: var(--space-3); justify-items: start; }
  .empty .headline, .empty p { margin: 0; }
  .recent { opacity: 0.85; }
</style>
```

- [ ] **Step 5: Implement the Home page** — `src/pages/index.astro`

```astro
---
import { Image } from 'astro:assets';
import BaseLayout from '../layouts/BaseLayout.astro';
import EventCard from '../components/EventCard.astro';
import UpcomingGuard from '../components/UpcomingGuard.astro';
import Button from '../components/Button.astro';
import { loadEvents } from '../lib/events';
import { whatsappLink } from '../lib/whatsappLink';
import { url } from '../lib/url';
import { site } from '../site.config';
import mark from '../assets/logos/sv-mark-cream.svg';
import hero from '../assets/art-forms/pearl-art.webp';
import hardy from '../assets/photos/hardy-sandhu-sip-paint.jpg';
import blossom from '../assets/logos/sv-blossom-neon.svg';
const { upcoming } = await loadEvents();
const next = upcoming.slice(0, 3);
const ways = [
  { title: 'Workshops', href: '/workshops', text: 'Two-hour sessions in a new art form, announced on Instagram. Come alone or bring a friend.' },
  { title: 'One-off classes', href: '/classes', text: 'Pick any of nine art forms and book a private class, or plan one for your group.' },
  { title: 'Learner packages', href: '/learn', text: 'Build real skills over 8 or 15 hour-long classes: drawing, sketching, acrylic, watercolour.' },
];
---
<BaseLayout title="Strokes & Verses" description="Art workshops, classes and learner packages by Balpreet Kaur in Sector 37-B, Chandigarh. Where art meets heart." theme="neon-night">
  <section class="hero" data-theme="neon-night">
    <div class="container hero-grid">
      <div class="hero-copy">
        <h1 class="hero-title">
          <img class="hero-mark" src={mark.src} alt="Strokes & Verses" width="220" height="220" />
        </h1>
        <p class="script tagline">Where art meets heart</p>
        <p class="lede">A studio in Sector 37-B, Chandigarh where anyone, with no training, makes something they’re proud of, and leaves calmer than they came in.</p>
        <div class="ctas">
          <Button href={url('/workshops')} glow>See workshops</Button>
          <Button href={whatsappLink({ kind: 'general' })} variant="outline" external testId="hero-cta">Ask on WhatsApp</Button>
        </div>
      </div>
      <Image class="hero-photo" src={hero} alt="Three pearl art seascapes held up in front of the lit Strokes & Verses neon sign" widths={[480, 800]} sizes="(min-width: 960px) 480px, 100vw" loading="eager" />
    </div>
  </section>

  <section class="section container" data-testid="home-upcoming" aria-labelledby="next-h">
    <p class="label">On the calendar</p>
    <h2 id="next-h" class="headline">Upcoming workshops</h2>
    <div class="grid grid--3" data-upcoming-list>{next.map((e) => <EventCard event={e} compact />)}</div>
    <div class="card empty" data-empty-upcoming hidden={next.length > 0}>
      <p>New workshops are announced on Instagram first.</p>
    </div>
    <p class="more"><Button href={url('/workshops')} variant="outline">See all workshops</Button></p>
  </section>

  <section class="section ways-wrap">
    <div class="container">
      <p class="label">Three ways to learn</p>
      <h2 class="headline">Find your way in</h2>
      <ul class="grid grid--3 ways" data-testid="ways">
        {ways.map((w) => (
          <li class="card way">
            <img src={blossom.src} alt="" width="36" height="36" />
            <h3><a href={url(w.href)}>{w.title}</a></h3>
            <p class="muted">{w.text}</p>
          </li>
        ))}
      </ul>
    </div>
  </section>

  <section class="section container loved" data-testid="loved-by" aria-labelledby="loved-h">
    <Image class="loved-photo" src={hardy} alt="Balpreet with singer Hardy Sandhu at the Sip & Paint workshop" widths={[320, 480]} sizes="(min-width: 768px) 320px, 70vw" />
    <div>
      <p class="label">Loved by</p>
      <h2 id="loved-h" class="headline">Hardy Sandhu painted with us</h2>
      <p class="title-italic">A private Sip &amp; Paint texture art party, led by Balpreet.</p>
      <p>From birthday tables to corporate teams, we bring the studio to your people. Tell us the occasion and we’ll plan the art.</p>
      <Button href={whatsappLink({ kind: 'group', artForm: 'Sip & Paint' })} variant="outline" external>Plan a group session</Button>
    </div>
  </section>

  <section class="section container founder" data-testid="founder">
    <p class="label">The artist</p>
    <h2 class="headline">“I have lived all my life with colours, brushes and blank canvases.”</h2>
    <p>Balpreet Kaur ran hospital projects and fashion boutiques before building Strokes &amp; Verses, an eco-conscious studio where art is for everyone.</p>
    <a href={url('/about')}>Meet Balpreet</a>
  </section>
  <UpcomingGuard />
</BaseLayout>

<style>
  .hero { padding-block: var(--space-12) var(--space-16); }
  .hero-grid { display: grid; gap: var(--space-8); align-items: center; }
  @media (min-width: 960px) { .hero-grid { grid-template-columns: 1.1fr 1fr; } }
  .hero-title { margin: 0; }
  .hero-mark { width: clamp(160px, 40vw, 220px); height: auto; }
  .tagline { margin: var(--space-4) 0 0; }
  .lede { max-width: 46ch; font-size: 18px; line-height: 28px; }
  .ctas { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-6); }
  .hero-photo { border-radius: var(--radius-lg); width: 100%; aspect-ratio: 4 / 5; object-fit: cover; }
  .more { margin-top: var(--space-6); }
  .empty { padding: var(--space-6); }
  .ways-wrap { background: var(--blush-soft); }
  .ways { list-style: none; padding: 0; margin: 0; }
  .way { padding: var(--space-6); display: grid; gap: var(--space-2); }
  .way h3 { font: 600 22px/28px var(--font-serif); margin: 0; }
  .way a { color: var(--ink); text-decoration-color: var(--neon); text-underline-offset: 4px; }
  .way p { margin: 0; }
  .loved { display: grid; gap: var(--space-8); align-items: center; }
  @media (min-width: 768px) { .loved { grid-template-columns: 320px 1fr; } }
  .loved-photo { border-radius: var(--radius-lg); width: min(320px, 70vw); aspect-ratio: 9 / 14; object-fit: cover; }
  .founder { max-width: 720px; }
</style>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx playwright test tests/e2e/home.spec.ts tests/e2e/workshops.spec.ts tests/e2e/layout.spec.ts`
Expected: PASS on both projects. If axe reports contrast on `.recent` opacity, remove the opacity rule instead of weakening the test.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: home page and workshop calendar with WhatsApp booking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Classes, Learn, About, Shop pages

**Files:**
- Create: `src/components/ArtFormCard.astro`, `src/components/PackageCard.astro`
- Modify: `src/pages/classes.astro`, `src/pages/learn.astro`, `src/pages/about.astro`, `src/pages/shop.astro`
- Test: `tests/e2e/classes.spec.ts`, `tests/e2e/learn.spec.ts`, `tests/e2e/about-shop.spec.ts`

**Interfaces:**
- Consumes: `artForms`, `packages`, `whatsappLink`, `Button`.
- Produces: `<ArtFormCard artForm: ArtForm>` (`data-testid="art-form-card"`, buttons `testId="book-private"` and `testId="book-group"`); `<PackageCard pkg: Package>` (`data-testid="package-card"`, button `testId="book-package"`, strikethrough `<s>` for `wasPrice`).

- [ ] **Step 1: Write the failing tests**

`tests/e2e/classes.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { expectWhatsApp, expectNoHorizontalScroll, checkA11y } from './helpers';

test.beforeEach(async ({ page }) => page.goto('/classes'));

test('shows nine art forms with duration and price', async ({ page }) => {
  const cards = page.getByTestId('art-form-card');
  await expect(cards).toHaveCount(9);
  const cloth = cards.filter({ hasText: 'Cloth Texture Art' });
  await expect(cloth).toContainText('3.5 hours');
  await expect(cloth).toContainText('₹2,800');
  await expect(cards.filter({ hasText: 'Kinusaiga' })).toContainText('Materials and frame included');
});

test('private and group booking open WhatsApp', async ({ page }) => {
  const pearl = page.getByTestId('art-form-card').filter({ hasText: 'Pearl Art' });
  await expectWhatsApp(pearl.getByTestId('book-private'), "Hi Balpreet, I'd like to book a private Pearl Art class.");
  await expectWhatsApp(pearl.getByTestId('book-group'), "Hi Balpreet, I'd like to plan a group Pearl Art session for ___ people.");
});

test('explains group pricing', async ({ page }) => {
  await expect(page.getByText(/custom pricing/i)).toBeVisible();
});

test('layout and accessibility', async ({ page }) => { await expectNoHorizontalScroll(page); await checkA11y(page); });
```

`tests/e2e/learn.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { expectWhatsApp, expectNoHorizontalScroll, checkA11y } from './helpers';

test.beforeEach(async ({ page }) => page.goto('/learn'));

test('shows both packages with prices', async ({ page }) => {
  const cards = page.getByTestId('package-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText('First Strokes');
  await expect(cards.nth(0)).toContainText('8 classes');
  await expect(cards.nth(0)).toContainText('₹4,000');
  await expect(cards.nth(1)).toContainText('Full Canvas');
  await expect(cards.nth(1)).toContainText('15 classes');
  await expect(cards.nth(1).locator('s')).toHaveText('₹7,500');
  await expect(cards.nth(1)).toContainText('₹7,000');
});

test('says painting materials are not included', async ({ page }) => {
  await expect(page.getByText(/materials are not included/i)).toBeVisible();
});

test('enquire opens WhatsApp', async ({ page }) => {
  await expectWhatsApp(page.getByTestId('package-card').nth(1).getByTestId('book-package'), "Hi Balpreet, I'm interested in the Full Canvas package.");
});

test('layout and accessibility', async ({ page }) => { await expectNoHorizontalScroll(page); await checkA11y(page); });
```

`tests/e2e/about-shop.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { expectNoHorizontalScroll, checkA11y } from './helpers';

test('about: portrait, quote, timeline, values', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Balpreet');
  await expect(page.getByRole('img', { name: /Balpreet/ })).toBeVisible();
  await expect(page.getByTestId('timeline').getByRole('listitem')).toHaveCount(4);
  await expect(page.getByTestId('values').getByRole('listitem')).toHaveCount(3);
  await expect(page.locator('main')).toContainText('Fortis');
  await expectNoHorizontalScroll(page);
  await checkA11y(page);
});

test('shop: coming soon with Instagram follow', async ({ page }) => {
  await page.goto('/shop');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Coming soon');
  await expect(page.getByRole('link', { name: /Follow/ })).toHaveAttribute('href', 'https://www.instagram.com/strokesandverses/');
  await expectNoHorizontalScroll(page);
  await checkA11y(page);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test tests/e2e/classes.spec.ts tests/e2e/learn.spec.ts tests/e2e/about-shop.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement cards**

`src/components/ArtFormCard.astro`:
```astro
---
import { Image } from 'astro:assets';
import Button from './Button.astro';
import type { ArtForm } from '../data/artForms';
import { whatsappLink } from '../lib/whatsappLink';
interface Props { artForm: ArtForm }
const { artForm: a } = Astro.props;
const hours = a.hours === 1 ? '1 hour' : `${a.hours} hours`;
---
<article class="card art" data-testid="art-form-card">
  <Image src={a.image} alt={a.alt} widths={[360, 640]} sizes="(min-width: 960px) 360px, (min-width: 640px) 50vw, 100vw" />
  <div class="body">
    <h3>{a.name}</h3>
    <p class="facts"><span>{hours}</span> · <span>₹{a.price.toLocaleString('en-IN')}</span></p>
    <p class="muted small">{a.includesNote}</p>
    <div class="actions">
      <Button href={whatsappLink({ kind: 'private', artForm: a.name })} external testId="book-private">Book a private class</Button>
      <Button href={whatsappLink({ kind: 'group', artForm: a.name })} variant="outline" external testId="book-group">Plan a group</Button>
    </div>
  </div>
</article>
<style>
  .art :global(img) { width: 100%; aspect-ratio: 1; object-fit: cover; }
  .body { padding: var(--space-6); display: grid; gap: var(--space-2); }
  h3 { font: 600 22px/28px var(--font-serif); margin: 0; }
  .facts { margin: 0; font-weight: 700; }
  .body p { margin: 0; }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
</style>
```

`src/components/PackageCard.astro`:
```astro
---
import Button from './Button.astro';
import type { Package } from '../data/packages';
import { whatsappLink } from '../lib/whatsappLink';
import blossom from '../assets/logos/sv-blossom-neon.svg';
interface Props { pkg: Package; featured?: boolean }
const { pkg, featured = false } = Astro.props;
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
---
<article class:list={['card', 'pkg', { featured }]} data-testid="package-card">
  <p class="label">{pkg.classes} classes · 1 hour each</p>
  <h3>{pkg.name}</h3>
  <p class="price">{pkg.wasPrice && <s>{rupees(pkg.wasPrice)}</s>} <strong>{rupees(pkg.price)}</strong></p>
  <p class="muted">{pkg.summary}</p>
  <ul>{pkg.points.map((p) => <li><img src={blossom.src} alt="" width="16" height="16" />{p}</li>)}</ul>
  <Button href={whatsappLink({ kind: 'package', name: pkg.name })} variant={featured ? 'primary' : 'outline'} external testId="book-package">Enquire on WhatsApp</Button>
</article>
<style>
  .pkg { padding: var(--space-8) var(--space-6); display: grid; gap: var(--space-3); justify-items: start; }
  .featured { border: 2px solid var(--neon); }
  h3 { font: 600 32px/38px var(--font-serif); margin: 0; }
  .price { margin: 0; font: 600 28px/32px var(--font-serif); }
  .price s { color: var(--ink-muted); font-size: 20px; margin-right: var(--space-2); }
  p { margin: 0; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
  li { display: flex; gap: var(--space-2); align-items: center; }
</style>
```

- [ ] **Step 4: Implement pages**

`src/pages/classes.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import ArtFormCard from '../components/ArtFormCard.astro';
import { artForms } from '../data/artForms';
---
<BaseLayout title="Classes" description="One-off art classes at Strokes & Verses: Kinusaiga, pearl art, texture art, tin embossing and more. Materials included.">
  <section class="section container">
    <p class="label">One-off classes</p>
    <h1 class="display">Pick an art form, leave with a finished piece</h1>
    <p class="title-italic">Every class includes materials. No experience needed.</p>
    <p class="note">Prices are per person for a private class. Planning something for a group, a party or your team? Group sessions have custom pricing, so tell us about the occasion on WhatsApp.</p>
  </section>
  <section class="container">
    <div class="grid grid--3">{artForms.map((a) => <ArtFormCard artForm={a} />)}</div>
  </section>
</BaseLayout>
<style>.note { max-width: 60ch; margin-top: var(--space-4); }</style>
```

`src/pages/learn.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import PackageCard from '../components/PackageCard.astro';
import { packages } from '../data/packages';
---
<BaseLayout title="Learn" description="Learner packages at Strokes & Verses: First Strokes (8 classes) and Full Canvas (15 classes) to build drawing, sketching, acrylic and watercolour skills.">
  <section class="section container">
    <p class="label">Learner packages</p>
    <h1 class="display">Build your basics, one hour at a time</h1>
    <p class="title-italic">Drawing, sketching, acrylic and watercolour, with small practice artworks along the way.</p>
  </section>
  <section class="container">
    <div class="grid grid--2">{packages.map((p, i) => <PackageCard pkg={p} featured={i === 1} />)}</div>
    <p class="muted note">Painting materials are not included in the packages. Balpreet will share a short list of what to bring.</p>
  </section>
</BaseLayout>
<style>.note { margin-top: var(--space-6); }</style>
```

`src/pages/about.astro`:
```astro
---
import { Image } from 'astro:assets';
import BaseLayout from '../layouts/BaseLayout.astro';
import Button from '../components/Button.astro';
import { whatsappLink } from '../lib/whatsappLink';
import portrait from '../assets/photos/hardy-sandhu-sip-paint.jpg';
import blossom from '../assets/logos/sv-blossom-neon.svg';
const timeline = [
  { when: 'Childhood', what: 'A daydreamer at a first-floor window above a busy market, watching festivals, patterns and people.' },
  { when: 'Healthcare', what: 'MHA, then healthcare administrator at Fortis Mohali, running the Covid vaccination drive in 2020–21.' },
  { when: 'Fashion', what: 'Founded Xpressions in Yamunanagar and The Wardrobe, a designer boutique in Chandigarh.' },
  { when: 'Today', what: 'Strokes & Verses: paintings in Chandigarh galleries, eco-friendly crafts, workshops and commissions.' },
];
const values = [
  { title: 'Kind to the planet', text: 'Natural and recycled materials, less waste, slow and mindful making.' },
  { title: 'Conscious, not complicated', text: 'Clear steps, calm sessions, no jargon.' },
  { title: 'Art for all', text: 'You don’t need to be “an artist”. Just come as you are.' },
];
---
<BaseLayout title="About Balpreet" description="Balpreet Kaur, artist and founder of Strokes & Verses, an eco-conscious art studio in Chandigarh.">
  <section class="section container intro">
    <Image class="portrait" src={portrait} alt="Balpreet Kaur, founder of Strokes & Verses" widths={[240, 480]} sizes="240px" />
    <div>
      <p class="label">Founder</p>
      <h1 class="display">Hi, I’m Balpreet</h1>
      <p class="title-italic">“I have lived all my life with colours, brushes, colour strokes, and blank canvases waiting to be painted.”</p>
      <p><strong>Strokes</strong> for the visual language I’ve spoken since childhood. <strong>Verses</strong> for the stories each piece tells.</p>
    </div>
  </section>

  <section class="section container" aria-labelledby="path-h">
    <h2 id="path-h" class="headline">The path here</h2>
    <ol class="timeline" data-testid="timeline">
      {timeline.map((t) => <li><p class="label">{t.when}</p><p>{t.what}</p></li>)}
    </ol>
  </section>

  <section class="section values-wrap" aria-labelledby="values-h">
    <div class="container">
      <h2 id="values-h" class="headline">What the studio stands for</h2>
      <ul class="grid grid--3 values" data-testid="values">
        {values.map((v) => <li class="card"><img src={blossom.src} alt="" width="32" height="32" /><h3>{v.title}</h3><p class="muted">{v.text}</p></li>)}
      </ul>
    </div>
  </section>

  <section class="section container commissions">
    <h2 class="headline">Paintings and commissions</h2>
    <p>Balpreet’s paintings hang in galleries around Chandigarh. She also paints for homes, offices and events.</p>
    <Button href={whatsappLink({ kind: 'general' })} variant="outline" external>Talk about a commission</Button>
  </section>
</BaseLayout>
<style>
  .intro { display: grid; gap: var(--space-8); align-items: center; }
  @media (min-width: 768px) { .intro { grid-template-columns: 240px 1fr; } }
  .portrait { width: 200px; height: 200px; border-radius: var(--radius-pill); object-fit: cover; object-position: 28% 14%; }
  @media (min-width: 768px) { .portrait { width: 240px; height: 240px; } }
  .timeline { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-6); border-left: 2px solid var(--line); }
  .timeline li { padding-left: var(--space-6); position: relative; }
  .timeline li::before { content: ''; position: absolute; left: -7px; top: 4px; width: 12px; height: 12px; border-radius: var(--radius-pill); background: var(--neon); }
  .timeline p { margin: 0; max-width: 60ch; }
  .values-wrap { background: var(--blush-soft); }
  .values { list-style: none; padding: 0; margin: 0; }
  .values li { padding: var(--space-6); display: grid; gap: var(--space-2); }
  .values h3 { font: 600 22px/28px var(--font-serif); margin: 0; }
  .values p { margin: 0; }
  .commissions { max-width: 720px; }
</style>
```

`src/pages/shop.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Button from '../components/Button.astro';
import { site } from '../site.config';
import blossom from '../assets/logos/sv-blossom-neon.svg';
---
<BaseLayout title="Shop" description="The Strokes & Verses shop is coming soon: hand-painted utility pieces and wearables." theme="neon-night">
  <section class="soon" data-theme="neon-night">
    <div class="container inner">
      <img class="blossom" src={blossom.src} alt="" width="96" height="96" />
      <p class="label">Shop</p>
      <h1 class="display">Coming soon</h1>
      <p class="title-italic">Hand-painted utility pieces and wearables, made slowly in the studio.</p>
      <Button href={site.instagramUrl} glow external>Follow for the first drop</Button>
    </div>
  </section>
</BaseLayout>
<style>
  .soon { min-height: 70vh; display: grid; place-items: center; padding-block: var(--space-16); }
  .inner { display: grid; justify-items: center; text-align: center; gap: var(--space-4); }
  .blossom { filter: drop-shadow(0 0 16px var(--neon-glow)); }
</style>
```

- [ ] **Step 5: Run the whole e2e suite**

Run: `npx playwright test`
Expected: PASS on both projects.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: classes, learner packages, about and shop pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Rule-based caption parser

**Files:**
- Create: `scripts/instagram-sync/artForms.ts`, `scripts/instagram-sync/parse.ts`, `scripts/instagram-sync/types.ts`
- Test: `tests/unit/parse.test.ts`, `tests/unit/fixtures.ts`

**Interfaces:**
- Consumes: `EventFields` (Task 3), `site.venue` (Task 2), `istParts` (Task 2), fixtures `content/fixtures/instagram-captions.json` (`{ name, postId, postedAt, expected: 'live' | 'draft' | 'ignore', caption }[]`).
- Produces:
  - `type Extraction = { isAnnouncement: boolean; confidence: 'high' | 'low'; needsFallback: boolean; event?: Partial<EventFields>; reasons: string[] }` in `types.ts`
  - `matchArtForms(text: string): string[]` (canonical names, in the alias list's fixed order)
  - `parseCaption(caption: string, postedAt: string): Extraction`
  - test helper `fixture(name: string)` returning the fixture object.

- [ ] **Step 1: Write the failing tests**

`tests/unit/fixtures.ts`:
```ts
import { readFileSync } from 'node:fs';
export type Fixture = { name: string; postId: string; postedAt: string; expected: 'live' | 'draft' | 'ignore'; caption: string };
export const fixtures: Fixture[] = JSON.parse(readFileSync('content/fixtures/instagram-captions.json', 'utf8'));
export const fixture = (name: string) => {
  const f = fixtures.find((x) => x.name === name);
  if (!f) throw new Error(`no fixture ${name}`);
  return f;
};
```

`tests/unit/parse.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseCaption } from '../../scripts/instagram-sync/parse';
import { matchArtForms } from '../../scripts/instagram-sync/artForms';
import { fixture, fixtures } from './fixtures';

const parse = (name: string) => { const f = fixture(name); return parseCaption(f.caption, f.postedAt); };

describe('matchArtForms', () => {
  it('prefers the specific name over overlapping general ones', () => {
    expect(matchArtForms('Cloth Texture Art class')).toEqual(['Cloth Texture Art']);
    expect(matchArtForms('Boho Acrylic Painting')).toEqual(['Boho Acrylic Painting']);
  });
  it('handles KinuSaiGa spellings', () => expect(matchArtForms('KINUSAIGA and KinuSaiGa')).toEqual(['Kinusaiga']));
  it('returns several in canonical order, not order of appearance', () => expect(matchArtForms('old denim pockets, then Paper Collage')).toEqual(['Paper Collage', 'Denim Pocket Frame']));
});

describe('parseCaption — announcements', () => {
  it('Kinusaiga 19 Sept (emoji details, no year)', () => {
    const x = parse('kinusaiga-19sept-a');
    expect(x).toMatchObject({ isAnnouncement: true, confidence: 'high', needsFallback: false });
    expect(x.event).toMatchObject({
      title: 'Kinusaiga Workshop', artForm: 'Kinusaiga',
      start: '2026-09-19T17:30:00+05:30', end: '2026-09-19T19:30:00+05:30',
      price: null, includes: ['All materials'], venue: 'Strokes & Verses Studio, Sector 37-B, Chandigarh',
    });
    expect(x.event!.description!.startsWith('No paint. No needle.')).toBe(true);
  });

  it('Double art Sunday combines two art forms', () => {
    const x = parse('double-art-20sept-a');
    expect(x.event).toMatchObject({
      title: 'Paper Collage & Denim Pocket Frame Workshop', artForm: 'Paper Collage & Denim Pocket Frame',
      start: '2026-09-20T15:30:00+05:30', end: '2026-09-20T17:30:00+05:30',
      includes: ['All materials', 'Refreshments'],
    });
    expect(x.confidence).toBe('high');
  });

  it('Kinusaiga 6 Sept (Date:/Time: labels, explicit year, Ask for the FEE)', () => {
    const x = parse('kinusaiga-6sept-labelled');
    expect(x.event).toMatchObject({
      start: '2026-09-06T15:30:00+05:30', end: '2026-09-06T17:30:00+05:30',
      price: null, includes: ['All materials', 'Frame', 'Refreshments'],
    });
    expect(x.confidence).toBe('high');
  });

  it('Kinusaiga 6 Sept (WHAT’S INCLUDED list)', () => {
    const x = parse('kinusaiga-6sept-details');
    expect(x.event).toMatchObject({ start: '2026-09-06T15:30:00+05:30', includes: ['All materials', 'Frame', 'Refreshments'] });
  });

  it('never takes the phone number as a price', () => {
    for (const f of fixtures) expect(parseCaption(f.caption, f.postedAt).event?.price ?? null).toBeNull();
  });
});

describe('parseCaption — prices, times, years', () => {
  const posted = '2026-09-01T10:00:00+05:30';
  const wrap = (details: string) => `PEARL ART IS BACK ✨\n\nSparkle all evening.\n\n${details}\n\nDM "PEARL" to book.`;
  it('reads ₹, Rs and /- prices', () => {
    expect(parseCaption(wrap('🗓️ Sunday, 5 October | 4 - 6 PM\n₹1,399 per person'), posted).event!.price).toBe(1399);
    expect(parseCaption(wrap('🗓️ Sunday, 5 October | 4 - 6 PM\nRs. 1299'), posted).event!.price).toBe(1299);
    expect(parseCaption(wrap('🗓️ Sunday, 5 October | 4 - 6 PM\nFee 1199/-'), posted).event!.price).toBe(1199);
  });
  it('infers am for a start that crosses noon', () => {
    expect(parseCaption(wrap('🗓️ Sunday, 5 October | 11:30 - 1:30 PM'), posted).event).toMatchObject({ start: '2026-10-05T11:30:00+05:30', end: '2026-10-05T13:30:00+05:30' });
  });
  it('rolls the year forward for January dates posted in December', () => {
    expect(parseCaption(wrap('🗓️ Saturday, 10th Jan | 5 - 7 PM'), '2026-12-20T10:00:00+05:30').event!.start).toBe('2027-01-10T17:00:00+05:30');
  });
  it('reads a single start time', () => {
    expect(parseCaption(wrap('🗓️ Sunday, 5 October\n⏰ 4 PM onwards'), posted).event).toMatchObject({ start: '2026-10-05T16:00:00+05:30', end: null });
  });
});

describe('parseCaption — ignored posts', () => {
  for (const name of ['hardy-sandhu-recap', 'two-days-thankyou', 'pearl-thankyou', 'brewing-teaser', 'kinusaiga-thankyou', 'kinusaiga-keywords-only']) {
    it(`${name} is not an announcement and needs no fallback`, () => {
      expect(parse(name)).toMatchObject({ isAnnouncement: false, needsFallback: false });
    });
  }
});

describe('parseCaption — fallback', () => {
  it('free-form caption with a date-like word and a booking cue asks for the LLM', () => {
    expect(parse('synthetic-freeform')).toMatchObject({ isAnnouncement: false, needsFallback: true });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/parse.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`scripts/instagram-sync/types.ts`:
```ts
import type { EventFields } from '../../src/lib/eventSchema';

export type Extraction = {
  isAnnouncement: boolean;
  confidence: 'high' | 'low';
  needsFallback: boolean;
  event?: Partial<EventFields>;
  reasons: string[];
};
```

`scripts/instagram-sync/artForms.ts`:
```ts
const ALIASES: [RegExp, string][] = [
  [/kinu\s*-?\s*sai\s*-?\s*ga/gi, 'Kinusaiga'],
  [/pearl\s*art/gi, 'Pearl Art'],
  [/cloth\s*texture(\s*art)?/gi, 'Cloth Texture Art'],
  [/impasto|texture\s*art/gi, 'Texture Art'],
  [/(acrylic\s*)?glass\s*painting/gi, 'Acrylic Glass Painting'],
  [/boho\s*mirror|mirror\s*decoration/gi, 'Boho Mirror Decoration'],
  [/boho\s*acrylic(\s*painting)?/gi, 'Boho Acrylic Painting'],
  [/(tin\s*)?embossing/gi, 'Tin Embossing'],
  [/paper\s*collage/gi, 'Paper Collage'],
  [/denim/gi, 'Denim Pocket Frame'],
  [/acrylic\s*painting/gi, 'Acrylic Painting'],
];

export function matchArtForms(text: string): string[] {
  const taken: [number, number][] = [];
  const names: string[] = [];
  for (const [re, name] of ALIASES) {
    for (const m of text.matchAll(re)) {
      const s = m.index!;
      const e = s + m[0].length;
      if (taken.some(([a, b]) => s < b && e > a)) continue;
      taken.push([s, e]);
      if (!names.includes(name)) names.push(name);
    }
  }
  return names;
}
```

`scripts/instagram-sync/parse.ts`:
```ts
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
  const postedKey = `${posted.year}-${pad(posted.month)}-${pad(posted.day)}`;
  if (!m[3] && `${year}-${pad(month)}-${pad(day)}` < postedKey) year += 1;
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
```

- [ ] **Step 4: Run tests; fix the implementation (not the tests) until green**

Run: `npx vitest run tests/unit/parse.test.ts`
Expected: PASS. If a real-caption case fails, adjust regexes in `parse.ts`/`artForms.ts`; the fixture expectations are the contract.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: rule-based Instagram caption parser tested on real captions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Classify and dedupe

**Files:**
- Create: `scripts/instagram-sync/classify.ts`, `scripts/instagram-sync/dedupe.ts`
- Test: `tests/unit/classify.test.ts`, `tests/unit/dedupe.test.ts`

**Interfaces:**
- Consumes: `Extraction`, `Event`, `EventFields`, `Source`, `EventFieldsSchema`, `istParts`.
- Produces:
  - `type Decision = 'live' | 'draft' | 'ignore'`; `classify(x: Extraction): Decision` — ignore if `!isAnnouncement`; draft if `confidence === 'low'` or `EventFieldsSchema` rejects `x.event`; else live.
  - `slugify(s: string): string` (`'Paper Collage & Denim Pocket Frame'` → `'paper-collage-denim-pocket-frame'`)
  - `eventId(artForm: string, start: string): string` (`'kinusaiga-2026-09-19-1730'`)
  - `buildEvent(fields: EventFields, sources: Source[], image: string | null): Event`
  - `type DedupeResult = { kind: 'create'; event: Event } | { kind: 'update'; event: Event } | { kind: 'skip' }`
  - `dedupe(candidate: Event, existing: Event[]): DedupeResult` — match by `id`; all candidate source ids already present → skip; else merge: sources unioned and sorted by `postedAt`; if candidate's newest `postedAt` is newer than existing's newest, candidate fields win (`image` falls back to existing when candidate's is null), else existing fields kept.

- [ ] **Step 1: Write the failing tests**

`tests/unit/classify.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { classify } from '../../scripts/instagram-sync/classify';
import { parseCaption } from '../../scripts/instagram-sync/parse';
import { fixtures } from './fixtures';

const full = { title: 'Kinusaiga Workshop', artForm: 'Kinusaiga', start: '2026-09-19T17:30:00+05:30', end: null, price: null, includes: [], venue: 'Studio', description: '' };

describe('classify', () => {
  it('ignores non-announcements', () => expect(classify({ isAnnouncement: false, confidence: 'high', needsFallback: false, reasons: [] })).toBe('ignore'));
  it('drafts low confidence', () => expect(classify({ isAnnouncement: true, confidence: 'low', needsFallback: false, event: full, reasons: [] })).toBe('draft'));
  it('drafts incomplete events', () => expect(classify({ isAnnouncement: true, confidence: 'high', needsFallback: false, event: { ...full, title: undefined }, reasons: [] })).toBe('draft'));
  it('publishes complete, confident events', () => expect(classify({ isAnnouncement: true, confidence: 'high', needsFallback: false, event: full, reasons: [] })).toBe('live'));
  it('matches every fixture’s expected outcome from the parser alone (fallback cases excluded)', () => {
    for (const f of fixtures.filter((f) => f.expected !== 'draft')) {
      expect([f.name, classify(parseCaption(f.caption, f.postedAt))]).toEqual([f.name, f.expected]);
    }
  });
});
```

`tests/unit/dedupe.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { slugify, eventId, buildEvent, dedupe } from '../../scripts/instagram-sync/dedupe';

const fields = { title: 'Kinusaiga Workshop', artForm: 'Kinusaiga', start: '2026-09-19T17:30:00+05:30', end: '2026-09-19T19:30:00+05:30', price: null, includes: ['All materials'], venue: 'Studio', description: 'old' };
const src = (postId: string, postedAt: string) => ({ postId, permalink: `https://www.instagram.com/p/${postId}/`, postedAt });

describe('ids', () => {
  it('slugifies', () => expect(slugify('Paper Collage & Denim Pocket Frame')).toBe('paper-collage-denim-pocket-frame'));
  it('builds an IST-based id', () => expect(eventId('Kinusaiga', '2026-09-19T12:00:00Z')).toBe('kinusaiga-2026-09-19-1730'));
  it('buildEvent sets id, image, sources', () => {
    expect(buildEvent(fields, [src('a', '2026-09-11T18:00:00+05:30')], null)).toMatchObject({ id: 'kinusaiga-2026-09-19-1730', image: null, sources: [{ postId: 'a' }] });
  });
});

describe('dedupe', () => {
  const existing = buildEvent(fields, [src('a', '2026-09-11T18:00:00+05:30')], '/images/events/x.jpg');
  it('creates when no id matches', () => {
    const other = buildEvent({ ...fields, start: '2026-10-01T17:30:00+05:30', end: null }, [src('b', '2026-09-20T10:00:00+05:30')], null);
    expect(dedupe(other, [existing]).kind).toBe('create');
  });
  it('skips a post it has already merged', () => {
    expect(dedupe(buildEvent(fields, [src('a', '2026-09-11T18:00:00+05:30')], null), [existing])).toEqual({ kind: 'skip' });
  });
  it('newer repost updates fields, keeps image, merges sources in order', () => {
    const repost = buildEvent({ ...fields, description: 'new' }, [src('b', '2026-09-12T18:00:00+05:30')], null);
    const r = dedupe(repost, [existing]);
    expect(r.kind).toBe('update');
    if (r.kind !== 'update') return;
    expect(r.event.description).toBe('new');
    expect(r.event.image).toBe('/images/events/x.jpg');
    expect(r.event.sources.map((s) => s.postId)).toEqual(['a', 'b']);
  });
  it('older post only adds its source', () => {
    const older = buildEvent({ ...fields, description: 'older' }, [src('z', '2026-09-01T18:00:00+05:30')], null);
    const r = dedupe(older, [existing]);
    if (r.kind !== 'update') throw new Error('expected update');
    expect(r.event.description).toBe('old');
    expect(r.event.sources.map((s) => s.postId)).toEqual(['z', 'a']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/classify.test.ts tests/unit/dedupe.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`scripts/instagram-sync/classify.ts`:
```ts
import { EventFieldsSchema } from '../../src/lib/eventSchema';
import type { Extraction } from './types';

export type Decision = 'live' | 'draft' | 'ignore';

export function classify(x: Extraction): Decision {
  if (!x.isAnnouncement) return 'ignore';
  if (x.confidence === 'low') return 'draft';
  return EventFieldsSchema.safeParse(x.event).success ? 'live' : 'draft';
}
```

`scripts/instagram-sync/dedupe.ts`:
```ts
import type { Event, EventFields, Source } from '../../src/lib/eventSchema';
import { istParts } from '../../src/lib/eventDates';

const pad = (n: number) => String(n).padStart(2, '0');

export function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function eventId(artForm: string, start: string): string {
  const p = istParts(start);
  return `${slugify(artForm)}-${p.year}-${pad(p.month)}-${pad(p.day)}-${pad(p.hour)}${pad(p.minute)}`;
}

export function buildEvent(fields: EventFields, sources: Source[], image: string | null): Event {
  return { id: eventId(fields.artForm, fields.start), ...fields, image, sources };
}

export type DedupeResult = { kind: 'create'; event: Event } | { kind: 'update'; event: Event } | { kind: 'skip' };

const newest = (e: Event) => Math.max(...e.sources.map((s) => Date.parse(s.postedAt)));

export function dedupe(candidate: Event, existing: Event[]): DedupeResult {
  const match = existing.find((e) => e.id === candidate.id);
  if (!match) return { kind: 'create', event: candidate };
  const known = new Set(match.sources.map((s) => s.postId));
  const fresh = candidate.sources.filter((s) => !known.has(s.postId));
  if (fresh.length === 0) return { kind: 'skip' };
  const sources = [...match.sources, ...fresh].sort((a, b) => Date.parse(a.postedAt) - Date.parse(b.postedAt));
  const base = newest(candidate) > newest(match)
    ? { ...candidate, id: match.id, image: candidate.image ?? match.image }
    : match;
  return { kind: 'update', event: { ...base, sources } };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: classify extractions and merge reposted workshops

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Store and removal

**Files:**
- Create: `scripts/instagram-sync/store.ts`, `scripts/instagram-sync/removal.ts`
- Test: `tests/unit/store.test.ts`, `tests/unit/removal.test.ts`

**Interfaces:**
- Consumes: `EventSchema`, `DraftSchema`, `StateSchema`, `Event`, `Draft`, `State`.
- Produces:
  - `type Paths = { eventsDir: string; draftsDir: string; imagesDir: string; imagesPublicPrefix: string; statePath: string }`
  - `defaultPaths(root = process.cwd()): Paths` → `src/content/events`, `data/drafts`, `public/images/events`, `/images/events`, `data/instagram-state.json`
  - `readEvents(p: Paths): Event[]`, `readDrafts(p: Paths): Draft[]`, `readState(p: Paths): State`
  - `type ChangeSet = { writeEvents: Event[]; deleteEvents: string[]; writeDrafts: Draft[]; deleteDrafts: string[]; state: State }`
  - `applyChanges(p: Paths, c: ChangeSet): void` (JSON with 2-space indent + trailing newline; file name `${id}.json`)
  - `downloadImage(p: Paths, url: string | null, id: string, fetchImpl?: typeof fetch): Promise<string | null>` → `'/images/events/{id}.jpg'` or null on any failure
  - `findRemovedEvents(events: Event[], fetched: { id: string; timestamp: string }[], now: Date): string[]`

- [ ] **Step 1: Write the failing tests**

`tests/unit/store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultPaths, readEvents, readDrafts, readState, applyChanges, downloadImage, type Paths } from '../../scripts/instagram-sync/store';

let p: Paths;
const ev = { id: 'kinusaiga-2026-09-19-1730', title: 'Kinusaiga Workshop', artForm: 'Kinusaiga', start: '2026-09-19T17:30:00+05:30', end: null, price: null, includes: [], venue: 'Studio', description: '', image: null, sources: [{ postId: 'a', permalink: 'https://www.instagram.com/p/a/', postedAt: '2026-09-11T18:00:00+05:30' }] };

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'sv-'));
  p = defaultPaths(root);
  for (const d of [p.eventsDir, p.draftsDir, p.imagesDir, join(root, 'data')]) mkdirSync(d, { recursive: true });
});

describe('store', () => {
  it('defaults state when the file is missing', () => expect(readState(p)).toEqual({ seenPostIds: [], lastRunAt: null, consecutiveFailures: 0 }));
  it('writes and reads back events, drafts and state', () => {
    const draft = { id: 'draft-9', event: {}, sources: ev.sources, reasons: ['x'], caption: 'c', draftIssue: 3 };
    const state = { seenPostIds: ['a'], lastRunAt: '2026-09-28T08:00:00+05:30', consecutiveFailures: 0 };
    applyChanges(p, { writeEvents: [ev], deleteEvents: [], writeDrafts: [draft], deleteDrafts: [], state });
    expect(readEvents(p)).toEqual([ev]);
    expect(readDrafts(p)).toEqual([draft]);
    expect(readState(p)).toEqual(state);
    expect(readFileSync(join(p.eventsDir, `${ev.id}.json`), 'utf8').endsWith('}\n')).toBe(true);
  });
  it('deletes events and drafts', () => {
    applyChanges(p, { writeEvents: [ev], deleteEvents: [], writeDrafts: [], deleteDrafts: [], state: readState(p) });
    writeFileSync(join(p.draftsDir, 'draft-1.json'), '{}');
    applyChanges(p, { writeEvents: [], deleteEvents: [ev.id], writeDrafts: [], deleteDrafts: ['draft-1'], state: readState(p) });
    expect(existsSync(join(p.eventsDir, `${ev.id}.json`))).toBe(false);
    expect(existsSync(join(p.draftsDir, 'draft-1.json'))).toBe(false);
  });
  it('ignores .gitkeep', () => {
    writeFileSync(join(p.eventsDir, '.gitkeep'), '');
    expect(readEvents(p)).toEqual([]);
  });
});

describe('downloadImage', () => {
  it('saves the bytes and returns the public path', async () => {
    const fake = (async () => new Response(new Uint8Array([1, 2, 3]))) as typeof fetch;
    expect(await downloadImage(p, 'https://cdn/x.jpg', 'e1', fake)).toBe('/images/events/e1.jpg');
    expect(readFileSync(join(p.imagesDir, 'e1.jpg'))).toEqual(Buffer.from([1, 2, 3]));
  });
  it('returns null on failure or missing url', async () => {
    const bad = (async () => new Response('no', { status: 403 })) as typeof fetch;
    expect(await downloadImage(p, 'https://cdn/x.jpg', 'e2', bad)).toBeNull();
    expect(await downloadImage(p, null, 'e3', bad)).toBeNull();
  });
});
```

`tests/unit/removal.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { findRemovedEvents } from '../../scripts/instagram-sync/removal';

const mk = (id: string, start: string, sources: [string, string][]) => ({
  id, title: 't', artForm: 'a', start, end: null, price: null, includes: [], venue: 'v', description: '', image: null,
  sources: sources.map(([postId, postedAt]) => ({ postId, permalink: 'https://www.instagram.com/', postedAt })),
});
const now = new Date('2026-09-15T10:00:00+05:30');
const fetched = [{ id: 'p3', timestamp: '2026-09-14T10:00:00+05:30' }, { id: 'p1', timestamp: '2026-09-01T10:00:00+05:30' }];

describe('findRemovedEvents', () => {
  it('removes an upcoming event whose only post vanished inside the fetched window', () => {
    expect(findRemovedEvents([mk('e', '2026-09-20T10:00:00+05:30', [['p2', '2026-09-10T10:00:00+05:30']])], fetched, now)).toEqual(['e']);
  });
  it('keeps events whose post is older than the window', () => {
    expect(findRemovedEvents([mk('e', '2026-09-20T10:00:00+05:30', [['p0', '2026-08-01T10:00:00+05:30']])], fetched, now)).toEqual([]);
  });
  it('keeps events with at least one surviving post', () => {
    expect(findRemovedEvents([mk('e', '2026-09-20T10:00:00+05:30', [['p2', '2026-09-10T10:00:00+05:30'], ['p3', '2026-09-14T10:00:00+05:30']])], fetched, now)).toEqual([]);
  });
  it('never removes past events', () => {
    expect(findRemovedEvents([mk('e', '2026-09-12T10:00:00+05:30', [['p2', '2026-09-10T10:00:00+05:30']])], fetched, now)).toEqual([]);
  });
  it('does nothing when the fetch is empty', () => {
    expect(findRemovedEvents([mk('e', '2026-09-20T10:00:00+05:30', [['p2', '2026-09-10T10:00:00+05:30']])], [], now)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/store.test.ts tests/unit/removal.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`scripts/instagram-sync/store.ts`:
```ts
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DraftSchema, EventSchema, StateSchema, type Draft, type Event, type State } from '../../src/lib/eventSchema';

export type Paths = { eventsDir: string; draftsDir: string; imagesDir: string; imagesPublicPrefix: string; statePath: string };
export type ChangeSet = { writeEvents: Event[]; deleteEvents: string[]; writeDrafts: Draft[]; deleteDrafts: string[]; state: State };

export function defaultPaths(root: string = process.cwd()): Paths {
  return {
    eventsDir: join(root, 'src/content/events'),
    draftsDir: join(root, 'data/drafts'),
    imagesDir: join(root, 'public/images/events'),
    imagesPublicPrefix: '/images/events',
    statePath: join(root, 'data/instagram-state.json'),
  };
}

const readJsonDir = (dir: string) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))) : [];
const writeJson = (path: string, data: unknown) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');

export const readEvents = (p: Paths): Event[] => readJsonDir(p.eventsDir).map((x) => EventSchema.parse(x));
export const readDrafts = (p: Paths): Draft[] => readJsonDir(p.draftsDir).map((x) => DraftSchema.parse(x));
export const readState = (p: Paths): State =>
  existsSync(p.statePath) ? StateSchema.parse(JSON.parse(readFileSync(p.statePath, 'utf8'))) : { seenPostIds: [], lastRunAt: null, consecutiveFailures: 0 };

export function applyChanges(p: Paths, c: ChangeSet): void {
  for (const e of c.writeEvents) writeJson(join(p.eventsDir, `${e.id}.json`), e);
  for (const id of c.deleteEvents) rmSync(join(p.eventsDir, `${id}.json`), { force: true });
  for (const d of c.writeDrafts) writeJson(join(p.draftsDir, `${d.id}.json`), d);
  for (const id of c.deleteDrafts) rmSync(join(p.draftsDir, `${id}.json`), { force: true });
  writeJson(p.statePath, c.state);
}

export async function downloadImage(p: Paths, url: string | null, id: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    writeFileSync(join(p.imagesDir, `${id}.jpg`), Buffer.from(await res.arrayBuffer()));
    return `${p.imagesPublicPrefix}/${id}.jpg`;
  } catch {
    return null;
  }
}
```

`scripts/instagram-sync/removal.ts`:
```ts
import type { Event } from '../../src/lib/eventSchema';

export function findRemovedEvents(events: Event[], fetched: { id: string; timestamp: string }[], now: Date): string[] {
  if (fetched.length === 0) return [];
  const oldest = Math.min(...fetched.map((m) => Date.parse(m.timestamp)));
  const ids = new Set(fetched.map((m) => m.id));
  return events
    .filter((e) => Date.parse(e.end ?? e.start) >= now.getTime())
    .filter((e) => e.sources.every((s) => !ids.has(s.postId) && Date.parse(s.postedAt) > oldest))
    .map((e) => e.id);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: event/draft/state storage, image download, deleted-post detection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Local LLM fallback (Ollama)

**Files:**
- Create: `scripts/instagram-sync/llm.ts`
- Test: `tests/unit/llm.test.ts`, `tests/unit/llm.live.test.ts` (opt-in)
- Modify: `package.json` (add `"test:llm": "LLM_LIVE=1 vitest run tests/unit/llm.live.test.ts"`), `vitest.config.ts` (exclude `*.live.test.ts` unless `LLM_LIVE`)

**Interfaces:**
- Consumes: `Extraction`, `matchArtForms`, `site.venue`.
- Produces: `type LlmOptions = { baseUrl?: string; model?: string; fetchImpl?: typeof fetch }`; `llmExtract(caption: string, postedAt: string, opts?: LlmOptions): Promise<Extraction>` — always `confidence: 'low'`, `needsFallback: false`. On any error: `{ isAnnouncement: true, confidence: 'low', needsFallback: false, event: {}, reasons: ['could not read automatically: <message>'] }`. Defaults: `baseUrl = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434'`, `model = 'qwen2.5:3b-instruct'`.

- [ ] **Step 1: Write the failing test** — `tests/unit/llm.test.ts`

```ts
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
});
```

`tests/unit/llm.live.test.ts`:
```ts
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
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'], exclude: process.env.LLM_LIVE ? [] : ['tests/unit/**/*.live.test.ts'] },
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/llm.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — `scripts/instagram-sync/llm.ts`

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS (live test excluded).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: local Ollama fallback for free-form captions (draft-only)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Instagram client and GitHub Issue client

**Files:**
- Create: `scripts/instagram-sync/instagram.ts`, `scripts/instagram-sync/issues.ts`
- Test: `tests/unit/instagram.test.ts`, `tests/unit/issues.test.ts`

**Interfaces:**
- Consumes: `Draft`, `formatLongDate`, `formatTimeRange`.
- Produces:
  - `type IgMedia = { id: string; caption: string; mediaType: string; imageUrl: string | null; permalink: string; timestamp: string }` (`timestamp` normalised to ISO with `+05:30`)
  - `fetchRecentMedia(token: string, fetchImpl?: typeof fetch): Promise<IgMedia[]>` (newest first, as Instagram returns)
  - `refreshToken(token: string, fetchImpl?: typeof fetch): Promise<string>`
  - Errors never include the token.
  - `interface GhClient { createIssue(title: string, body: string, labels: string[]): Promise<number> }`
  - `ghCli(run?: (args: string[]) => Promise<string>): GhClient` (default runs the `gh` binary via `execFile`)
  - `draftIssueTitle(d: Draft): string`, `draftIssueBody(d: Draft, permalink: string): string`

- [ ] **Step 1: Write the failing tests**

`tests/unit/instagram.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { fetchRecentMedia, refreshToken } from '../../scripts/instagram-sync/instagram';

const ok = (json: unknown, check?: (u: URL) => void) => (async (input: RequestInfo | URL) => {
  check?.(new URL(String(input)));
  return new Response(JSON.stringify(json));
}) as typeof fetch;

describe('fetchRecentMedia', () => {
  it('requests the right fields and normalises media', async () => {
    const media = await fetchRecentMedia('TOKEN123', ok({ data: [
      { id: '1', caption: 'hi', media_type: 'VIDEO', thumbnail_url: 'https://t/1.jpg', media_url: 'https://v/1.mp4', permalink: 'https://www.instagram.com/reel/1/', timestamp: '2026-09-12T12:30:00+0000' },
      { id: '2', media_type: 'IMAGE', media_url: 'https://i/2.jpg', permalink: 'https://www.instagram.com/p/2/', timestamp: '2026-09-11T12:30:00+0000' },
    ] }, (u) => {
      expect(u.pathname).toMatch(/\/me\/media$/);
      expect(u.searchParams.get('fields')).toBe('id,caption,media_type,media_url,thumbnail_url,permalink,timestamp');
      expect(u.searchParams.get('limit')).toBe('25');
    }));
    expect(media).toEqual([
      { id: '1', caption: 'hi', mediaType: 'VIDEO', imageUrl: 'https://t/1.jpg', permalink: 'https://www.instagram.com/reel/1/', timestamp: '2026-09-12T18:00:00+05:30' },
      { id: '2', caption: '', mediaType: 'IMAGE', imageUrl: 'https://i/2.jpg', permalink: 'https://www.instagram.com/p/2/', timestamp: '2026-09-11T18:00:00+05:30' },
    ]);
  });
  it('throws a useful error without leaking the token', async () => {
    const bad = (async () => new Response(JSON.stringify({ error: { message: 'Invalid OAuth access token' } }), { status: 400 })) as typeof fetch;
    await expect(fetchRecentMedia('SECRET_TOKEN', bad)).rejects.toThrow(/Instagram API 400: Invalid OAuth access token/);
    await expect(fetchRecentMedia('SECRET_TOKEN', bad)).rejects.not.toThrow(/SECRET_TOKEN/);
  });
});

describe('refreshToken', () => {
  it('returns the refreshed token', async () => {
    expect(await refreshToken('OLD', ok({ access_token: 'NEW', expires_in: 5184000 }, (u) => {
      expect(u.pathname).toBe('/refresh_access_token');
      expect(u.searchParams.get('grant_type')).toBe('ig_refresh_token');
    }))).toBe('NEW');
  });
});
```

`tests/unit/issues.test.ts`:
```ts
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
    expect(b).toContain('> Pearl art next sunday evening');
    expect(b).toContain('https://www.instagram.com/p/123/');
    expect(b).toContain('`publish`');
    expect(b).toContain('data/drafts/draft-123.json');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/instagram.test.ts tests/unit/issues.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`scripts/instagram-sync/instagram.ts`:
```ts
const GRAPH = 'https://graph.instagram.com';
const FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';

export type IgMedia = { id: string; caption: string; mediaType: string; imageUrl: string | null; permalink: string; timestamp: string };

function toIst(ts: string): string {
  const d = new Date(ts.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  const ist = new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 19);
  return `${ist}+05:30`;
}

async function getJson(url: URL, fetchImpl: typeof fetch) {
  const res = await fetchImpl(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Instagram API ${res.status}: ${json?.error?.message ?? 'unknown error'}`);
  return json;
}

export async function fetchRecentMedia(token: string, fetchImpl: typeof fetch = fetch): Promise<IgMedia[]> {
  const url = new URL(`${GRAPH}/v23.0/me/media`);
  url.searchParams.set('fields', FIELDS);
  url.searchParams.set('limit', '25');
  url.searchParams.set('access_token', token);
  const json = await getJson(url, fetchImpl);
  return (json.data ?? []).map((m: any) => ({
    id: String(m.id),
    caption: m.caption ?? '',
    mediaType: m.media_type,
    imageUrl: (m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url) ?? null,
    permalink: m.permalink,
    timestamp: toIst(m.timestamp),
  }));
}

export async function refreshToken(token: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const url = new URL(`${GRAPH}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', token);
  return (await getJson(url, fetchImpl)).access_token;
}
```

`scripts/instagram-sync/issues.ts`:
```ts
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
    'The Instagram checker found a post it wasn’t sure about.',
    '',
    '| Field | Read as |', '| --- | --- |',
    row('Workshop', e.title),
    row('Date', e.start ? formatLongDate(e.start) : undefined),
    row('Time', e.start ? formatTimeRange(e.start, e.end ?? null) : undefined),
    row('Price', e.price === undefined ? undefined : e.price === null ? 'Ask for fee' : `₹${e.price.toLocaleString('en-IN')}`),
    '',
    `**Why it’s a draft:** ${d.reasons.join('; ') || 'low confidence'}`,
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
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Instagram Graph API client and GitHub draft issues

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Sync orchestration and CLI

**Files:**
- Create: `scripts/instagram-sync/sync.ts`, `scripts/instagram-sync/main.ts`
- Test: `tests/unit/sync.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 7–11.
- Produces:
  - `needsLlm(media: IgMedia[], seen: string[]): boolean` (any unseen post whose `parseCaption(...).needsFallback` is true)
  - `type SyncDeps = { media: IgMedia[]; now: Date; paths: Paths; llm: (caption: string, postedAt: string) => Promise<Extraction>; gh: GhClient; download: (url: string | null, id: string) => Promise<string | null> }`
  - `type SyncResult = { created: string[]; updated: string[]; drafted: string[]; ignored: string[]; removed: string[] }`
  - `sync(deps: SyncDeps): Promise<SyncResult>` — processes unseen posts oldest-first, writes everything once at the end via `applyChanges`, sets `state.lastRunAt` (IST ISO) and `consecutiveFailures: 0`.
  - CLI `npm run sync -- [--plan]`: env `IG_ACCESS_TOKEN` (required), `GITHUB_OUTPUT`, `RUNNER_TEMP`. `--plan` writes `needs_llm=true|false` to `GITHUB_OUTPUT`. Full run refreshes the token and writes it to `$RUNNER_TEMP/ig_token` if it changed. On failure: increments `consecutiveFailures`, writes state, opens an `alert` issue when it reaches 2, exits 1.

- [ ] **Step 1: Write the failing test** — `tests/unit/sync.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sync, needsLlm } from '../../scripts/instagram-sync/sync';
import { defaultPaths, readEvents, readDrafts, readState, type Paths } from '../../scripts/instagram-sync/store';
import type { IgMedia } from '../../scripts/instagram-sync/instagram';
import { fixtures } from './fixtures';

let p: Paths;
const issues: { title: string; labels: string[] }[] = [];
const gh = { createIssue: async (title: string, _b: string, labels: string[]) => { issues.push({ title, labels }); return 100 + issues.length; } };
const media: IgMedia[] = fixtures.map((f) => ({ id: f.postId, caption: f.caption, mediaType: 'IMAGE', imageUrl: null, permalink: 'https://www.instagram.com/strokesandverses/', timestamp: f.postedAt }))
  .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
const llm = async () => ({ isAnnouncement: true, confidence: 'low' as const, needsFallback: false, event: { artForm: 'Pearl Art', title: 'Pearl Art Workshop' }, reasons: ['read by the local model; please check'] });
const now = new Date('2026-09-28T08:00:00+05:30');

beforeEach(() => {
  issues.length = 0;
  const root = mkdtempSync(join(tmpdir(), 'sv-sync-'));
  p = defaultPaths(root);
  for (const d of [p.eventsDir, p.draftsDir, p.imagesDir, join(root, 'data')]) mkdirSync(d, { recursive: true });
});

describe('sync over the real caption fixtures', () => {
  it('needs the LLM only because of the free-form caption', () => {
    expect(needsLlm(media, [])).toBe(true);
    expect(needsLlm(media, ['fixture-synthetic-freeform'])).toBe(false);
  });

  it('produces exactly the three seed events, one draft and ignores the rest', async () => {
    const r = await sync({ media, now, paths: p, llm, gh, download: async () => null });
    expect(r.created.sort()).toEqual(['kinusaiga-2026-09-06-1530', 'kinusaiga-2026-09-19-1730', 'paper-collage-denim-pocket-frame-2026-09-20-1530']);
    expect(r.updated.sort()).toEqual(r.created.slice().sort());
    expect(r.drafted).toEqual(['draft-fixture-synthetic-freeform']);
    expect(r.ignored).toHaveLength(6);

    const seeds = ['kinusaiga-2026-09-06-1530', 'kinusaiga-2026-09-19-1730', 'paper-collage-denim-pocket-frame-2026-09-20-1530']
      .map((id) => JSON.parse(readFileSync(`src/content/events/${id}.json`, 'utf8')));
    expect(readEvents(p)).toEqual(seeds);

    const [draft] = readDrafts(p);
    expect(draft).toMatchObject({ id: 'draft-fixture-synthetic-freeform', draftIssue: 101 });
    expect(issues).toEqual([{ title: 'Draft: new Instagram post needs a look', labels: ['draft'] }]);

    const state = readState(p);
    expect(state.seenPostIds).toHaveLength(fixtures.length);
    expect(state.lastRunAt).toBe('2026-09-28T08:00:00+05:30');
  });

  it('is idempotent: a second run changes nothing', async () => {
    await sync({ media, now, paths: p, llm, gh, download: async () => null });
    const r = await sync({ media, now, paths: p, llm, gh, download: async () => null });
    expect(r).toEqual({ created: [], updated: [], drafted: [], ignored: [], removed: [] });
    expect(issues).toHaveLength(1);
  });

  it('stores the downloaded image path on created events', async () => {
    await sync({ media, now, paths: p, llm, gh, download: async (_u, id) => `/images/events/${id}.jpg` });
    expect(readEvents(p).every((e) => e.image === `/images/events/${e.id}.jpg`)).toBe(true);
  });
});
```

Note: with `download: async () => null` the created events' `image` stays null, matching the seeds. If the parser's `description` differs from a seed file, update the **seed file** to the parser's output (the parser is the source of truth), then re-run Task 5's e2e tests.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/sync.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — `scripts/instagram-sync/sync.ts`

```ts
import type { Draft, Event, EventFields, Source } from '../../src/lib/eventSchema';
import { istParts } from '../../src/lib/eventDates';
import { parseCaption } from './parse';
import { classify } from './classify';
import { buildEvent, dedupe } from './dedupe';
import { findRemovedEvents } from './removal';
import { applyChanges, readEvents, readState, type Paths } from './store';
import { draftIssueBody, draftIssueTitle, type GhClient } from './issues';
import type { IgMedia } from './instagram';
import type { Extraction } from './types';

export type SyncDeps = {
  media: IgMedia[];
  now: Date;
  paths: Paths;
  llm: (caption: string, postedAt: string) => Promise<Extraction>;
  gh: GhClient;
  download: (url: string | null, id: string) => Promise<string | null>;
};
export type SyncResult = { created: string[]; updated: string[]; drafted: string[]; ignored: string[]; removed: string[] };

const pad = (n: number) => String(n).padStart(2, '0');
const istIso = (d: Date) => {
  const p = istParts(d.toISOString());
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(d.getUTCSeconds())}+05:30`;
};

export function needsLlm(media: IgMedia[], seen: string[]): boolean {
  const s = new Set(seen);
  return media.some((m) => !s.has(m.id) && parseCaption(m.caption, m.timestamp).needsFallback);
}

export async function sync(d: SyncDeps): Promise<SyncResult> {
  const state = readState(d.paths);
  const seen = new Set(state.seenPostIds);
  const events = new Map<string, Event>(readEvents(d.paths).map((e) => [e.id, e]));
  const result: SyncResult = { created: [], updated: [], drafted: [], ignored: [], removed: [] };
  const writeEvents = new Map<string, Event>();
  const writeDrafts: Draft[] = [];

  const fresh = d.media.filter((m) => !seen.has(m.id)).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  for (const m of fresh) {
    const source: Source = { postId: m.id, permalink: m.permalink, postedAt: m.timestamp };
    let x = parseCaption(m.caption, m.timestamp);
    if (x.needsFallback) x = await d.llm(m.caption, m.timestamp);
    const decision = classify(x);

    if (decision === 'ignore') result.ignored.push(m.id);
    if (decision === 'draft') {
      const draft: Draft = { id: `draft-${m.id}`, event: x.event ?? {}, sources: [source], reasons: x.reasons, caption: m.caption };
      draft.draftIssue = await d.gh.createIssue(draftIssueTitle(draft), draftIssueBody(draft, m.permalink), ['draft']);
      writeDrafts.push(draft);
      result.drafted.push(draft.id);
    }
    if (decision === 'live') {
      const candidate = buildEvent(x.event as EventFields, [source], null);
      const r = dedupe(candidate, [...events.values()]);
      if (r.kind !== 'skip') {
        const event = r.event.image ? r.event : { ...r.event, image: await d.download(m.imageUrl, r.event.id) };
        events.set(event.id, event);
        writeEvents.set(event.id, event);
        (r.kind === 'create' ? result.created : result.updated).push(event.id);
      }
    }
    seen.add(m.id);
  }

  result.removed = findRemovedEvents([...events.values()], d.media.map((m) => ({ id: m.id, timestamp: m.timestamp })), d.now);
  for (const id of result.removed) writeEvents.delete(id);

  applyChanges(d.paths, {
    writeEvents: [...writeEvents.values()],
    deleteEvents: result.removed,
    writeDrafts,
    deleteDrafts: [],
    state: { seenPostIds: [...seen], lastRunAt: istIso(d.now), consecutiveFailures: 0 },
  });
  return result;
}
```

Note on the expected `updated` list: each seed event is built from two posts, so the first post creates it and the second updates it. `created` and `updated` therefore both contain the three ids.

- [ ] **Step 4: Implement the CLI** — `scripts/instagram-sync/main.ts`

```ts
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
```

- [ ] **Step 5: Run all unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Instagram sync orchestration and CLI with failure alerts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Draft review (publish / discard)

**Files:**
- Create: `scripts/review-draft.ts`
- Test: `tests/unit/review-draft.test.ts`

**Interfaces:**
- Consumes: `readDrafts`, `readEvents`, `readState`, `applyChanges`, `EventFieldsSchema`, `buildEvent`, `dedupe`, `formatLongDate`.
- Produces: `type ReviewResult = { ok: boolean; changed: boolean; message: string }`; `reviewDraft(paths: Paths, issueNumber: number, label: string): ReviewResult`. CLI: `npm run -s review-draft -- <issueNumber> <label>` prints `message` to stdout, exits 0 if `ok`, 2 if not.

- [ ] **Step 1: Write the failing test** — `tests/unit/review-draft.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reviewDraft } from '../../scripts/review-draft';
import { defaultPaths, applyChanges, readEvents, readDrafts, readState, type Paths } from '../../scripts/instagram-sync/store';

let p: Paths;
const source = { postId: '9', permalink: 'https://www.instagram.com/p/9/', postedAt: '2026-09-25T18:00:00+05:30' };
const complete = { title: 'Pearl Art Workshop', artForm: 'Pearl Art', start: '2026-10-04T17:00:00+05:30', end: null, price: null, includes: [], venue: 'Studio', description: '' };

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'sv-rev-'));
  p = defaultPaths(root);
  for (const d of [p.eventsDir, p.draftsDir, p.imagesDir, join(root, 'data')]) mkdirSync(d, { recursive: true });
});

const seed = (event: object) => applyChanges(p, { writeEvents: [], deleteEvents: [], deleteDrafts: [], state: readState(p),
  writeDrafts: [{ id: 'draft-9', event, sources: [source], reasons: [], caption: 'c', draftIssue: 7 }] });

describe('reviewDraft', () => {
  it('publish moves a complete draft to a live event', () => {
    seed(complete);
    const r = reviewDraft(p, 7, 'publish');
    expect(r).toEqual({ ok: true, changed: true, message: 'Published **Pearl Art Workshop** on Sunday 4 October. The site will update in a few minutes.' });
    expect(readEvents(p).map((e) => e.id)).toEqual(['pearl-art-2026-10-04-1700']);
    expect(readDrafts(p)).toEqual([]);
  });
  it('publish refuses an incomplete draft and names what is missing', () => {
    seed({ artForm: 'Pearl Art' });
    const r = reviewDraft(p, 7, 'publish');
    expect(r.ok).toBe(false);
    expect(r.changed).toBe(false);
    expect(r.message).toContain('title, start');
    expect(r.message).toContain('data/drafts/draft-9.json');
    expect(existsSync(join(p.draftsDir, 'draft-9.json'))).toBe(true);
  });
  it('discard deletes the draft', () => {
    seed(complete);
    expect(reviewDraft(p, 7, 'discard')).toEqual({ ok: true, changed: true, message: 'Discarded. It won’t appear on the site.' });
    expect(readDrafts(p)).toEqual([]);
  });
  it('is idempotent when the draft is gone', () => {
    expect(reviewDraft(p, 7, 'publish')).toEqual({ ok: true, changed: false, message: 'Already handled.' });
  });
  it('ignores other labels', () => {
    seed(complete);
    expect(reviewDraft(p, 7, 'bug')).toEqual({ ok: true, changed: false, message: 'Nothing to do for label "bug".' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/review-draft.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — `scripts/review-draft.ts`

```ts
import { pathToFileURL } from 'node:url';
import { EventFieldsSchema } from '../src/lib/eventSchema';
import { formatLongDate } from '../src/lib/eventDates';
import { applyChanges, defaultPaths, readDrafts, readEvents, readState, type Paths } from './instagram-sync/store';
import { buildEvent, dedupe } from './instagram-sync/dedupe';

export type ReviewResult = { ok: boolean; changed: boolean; message: string };

export function reviewDraft(paths: Paths, issueNumber: number, label: string): ReviewResult {
  if (label !== 'publish' && label !== 'discard') return { ok: true, changed: false, message: `Nothing to do for label "${label}".` };
  const draft = readDrafts(paths).find((d) => d.draftIssue === issueNumber);
  if (!draft) return { ok: true, changed: false, message: 'Already handled.' };
  const state = readState(paths);

  if (label === 'discard') {
    applyChanges(paths, { writeEvents: [], deleteEvents: [], writeDrafts: [], deleteDrafts: [draft.id], state });
    return { ok: true, changed: true, message: 'Discarded. It won’t appear on the site.' };
  }

  const parsed = EventFieldsSchema.safeParse(draft.event);
  if (!parsed.success) {
    const missing = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].join(', ');
    return { ok: false, changed: false, message: `Can’t publish yet: ${missing} missing or invalid. Edit \`data/drafts/${draft.id}.json\` on GitHub, then add the \`publish\` label again.` };
  }
  const candidate = buildEvent(parsed.data, draft.sources, null);
  const r = dedupe(candidate, readEvents(paths));
  const writeEvents = r.kind === 'skip' ? [] : [r.event];
  applyChanges(paths, { writeEvents, deleteEvents: [], writeDrafts: [], deleteDrafts: [draft.id], state });
  return { ok: true, changed: true, message: `Published **${parsed.data.title}** on ${formatLongDate(parsed.data.start)}. The site will update in a few minutes.` };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [issue, label] = process.argv.slice(2);
  const r = reviewDraft(defaultPaths(), Number(issue), label ?? '');
  console.log(r.message);
  process.exit(r.ok ? 0 : 2);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: publish/discard drafts from GitHub issue labels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: GitHub workflows and the maintainer README

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/workflows/instagram-sync.yml`, `.github/workflows/review-draft.yml`, `.github/workflows/test.yml`, `README.md`
- Test: `tests/unit/workflows.test.ts`

**Interfaces:**
- Consumes: npm scripts `build`, `test`, `test:e2e`, `sync`, `review-draft`.
- Produces: scheduled sync at 02:30 and 14:30 UTC; deploy via `workflow_dispatch` and on push to `main`; review on `issues: labeled`.

- [ ] **Step 1: Write the failing test** — `tests/unit/workflows.test.ts`

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/workflows.test.ts`
Expected: FAIL — files missing.

- [ ] **Step 3: Write the workflows**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy site
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
        env:
          SITE_URL: ${{ vars.SITE_URL }}
          BASE_PATH: ${{ vars.BASE_PATH }}
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`.github/workflows/instagram-sync.yml`:
```yaml
name: Instagram sync
on:
  schedule:
    - cron: '30 2 * * *'
    - cron: '30 14 * * *'
  workflow_dispatch:
permissions:
  contents: write
  issues: write
  actions: write
concurrency:
  group: instagram-sync
jobs:
  sync:
    runs-on: ubuntu-latest
    env:
      IG_ACCESS_TOKEN: ${{ secrets.IG_ACCESS_TOKEN }}
      GH_TOKEN: ${{ github.token }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - id: plan
        run: npm run sync -- --plan
      - if: steps.plan.outputs.needs_llm == 'true'
        uses: actions/cache@v4
        with:
          path: ~/.ollama/models
          key: ollama-qwen2.5-3b-instruct
      - if: steps.plan.outputs.needs_llm == 'true'
        run: |
          curl -fsSL https://ollama.com/install.sh | sh
          (ollama serve > /tmp/ollama.log 2>&1 &)
          sleep 5
          ollama pull qwen2.5:3b-instruct
      - id: run
        run: npm run sync
      - name: Save renewed Instagram token
        if: success()
        env:
          GH_TOKEN: ${{ secrets.IG_TOKEN_PAT }}
        run: |
          if [ -f "$RUNNER_TEMP/ig_token" ]; then gh secret set IG_ACCESS_TOKEN < "$RUNNER_TEMP/ig_token"; fi
      - name: Commit changes
        if: always()
        run: |
          git config user.name "strokes-and-verses-bot"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add src/content/events data public/images/events
          git diff --cached --quiet || git commit -m "sync: Instagram $(date -u +%Y-%m-%dT%H:%MZ)"
          git push
      - name: Rebuild site
        if: success()
        run: gh workflow run deploy.yml
```

`.github/workflows/review-draft.yml`:
```yaml
name: Review draft
on:
  issues:
    types: [labeled]
permissions:
  contents: write
  issues: write
  actions: write
concurrency:
  group: instagram-sync
jobs:
  review:
    if: github.event.label.name == 'publish' || github.event.label.name == 'discard'
    runs-on: ubuntu-latest
    env:
      GH_TOKEN: ${{ github.token }}
      ISSUE: ${{ github.event.issue.number }}
      LABEL: ${{ github.event.label.name }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - id: review
        run: |
          set +e
          npm run -s review-draft -- "$ISSUE" "$LABEL" > "$RUNNER_TEMP/msg.txt"
          echo "code=$?" >> "$GITHUB_OUTPUT"
      - name: Commit
        if: steps.review.outputs.code == '0'
        run: |
          git config user.name "strokes-and-verses-bot"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add src/content/events data
          git diff --cached --quiet || { git commit -m "review: $LABEL draft from issue #$ISSUE"; git push; gh workflow run deploy.yml; }
      - name: Reply and close
        if: steps.review.outputs.code == '0'
        run: |
          gh issue comment "$ISSUE" --body-file "$RUNNER_TEMP/msg.txt"
          gh issue close "$ISSUE"
      - name: Explain what's missing
        if: steps.review.outputs.code != '0'
        run: |
          gh issue comment "$ISSUE" --body-file "$RUNNER_TEMP/msg.txt"
          gh issue edit "$ISSUE" --remove-label "$LABEL"
```

`.github/workflows/test.yml`:
```yaml
name: Test
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env: { CI: 'true' }
```

- [ ] **Step 4: Write `README.md`** (for Chetan; plain language)

```markdown
# Strokes & Verses website

The studio's website. Workshops appear on it automatically from Instagram.

## How the calendar fills itself
1. Balpreet posts a workshop on Instagram as usual (date, time and 📍 lines like always).
2. Twice a day (8 am and 8 pm) a free GitHub job reads new posts.
3. Clear workshop posts go live on the site within minutes. Thank-you posts and teasers are ignored.
4. If a post is unclear, you get a GitHub issue called **Draft: …**. Open it and:
   - add the `publish` label to put it live, or `discard` to drop it;
   - if a detail is wrong, edit the file named in the issue first, then add `publish`.

## Changing prices or classes
- One-off classes: `src/data/artForms.ts`
- Packages: `src/data/packages.ts`
- Phone, address, Instagram: `src/site.config.ts`
Edit on GitHub in the browser and commit; the site rebuilds by itself.

## Fixing or removing a workshop by hand
Workshops are files in `src/content/events/`. Edit or delete one on GitHub. If you delete the Instagram post before the workshop date, the site removes it on the next run.

## One-time setup (all free)
1. **Pages:** Settings → Pages → Source: GitHub Actions. Until the domain is connected, set repo variable `BASE_PATH` to `/<repo-name>/` and `SITE_URL` to `https://<user>.github.io`.
2. **Instagram token:** create a Meta developer app → add "Instagram API with Instagram Login" → generate a long-lived token for @strokesandverses → save as repo secret `IG_ACCESS_TOKEN`.
3. **Token renewal:** create a fine-grained GitHub token for this repo only with "Secrets: Read and write" → save as repo secret `IG_TOKEN_PAT`.
4. **Labels:** create `draft`, `publish`, `discard`, `alert`.
5. **Notifications:** Watch the repo (Custom → Issues). Add Balpreet as a collaborator so she gets the emails too.
6. **Domain:** Settings → Pages → Custom domain; set `BASE_PATH` to `/` and `SITE_URL` to your domain.

## Developing
npm ci · npm run dev · npm test · npm run test:e2e · npm run tokens (after changing content/brand/tokens.json)
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "ci: Pages deploy, twice-daily Instagram sync, label-driven draft review, maintainer README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Motion and polish

**Files:**
- Create: `src/components/Reveal.astro`
- Modify: `src/pages/index.astro` (hero mark light-up, reveal on sections), `src/layouts/BaseLayout.astro` (include Reveal script), `src/styles/global.css`
- Test: `tests/e2e/motion.spec.ts`

**Interfaces:**
- Consumes: pages from Tasks 5–6.
- Produces: `.reveal` class (fade + 8px rise, 280ms ease-out, once, via IntersectionObserver; content visible without JS); `.hero-mark` neon light-up (opacity/filter keyframes 900ms, once on load). Both disabled under reduced motion.

- [ ] **Step 1: Write the failing test** — `tests/e2e/motion.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('reduced motion: no animations, everything visible', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  const mark = page.locator('.hero-mark');
  expect(await mark.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  for (const el of await page.locator('.reveal').all()) await expect(el).toHaveCSS('opacity', '1');
  await ctx.close();
});

test('with motion: hero mark lights up once and sections reveal on scroll', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('.hero-mark').evaluate((el) => getComputedStyle(el).animationName)).toBe('sv-light-up');
  const last = page.locator('.reveal').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveClass(/is-visible/);
});

test('content is visible without JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  for (const el of await page.locator('.reveal').all()) await expect(el).toHaveCSS('opacity', '1');
  await ctx.close();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test tests/e2e/motion.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `src/styles/global.css`:
```css
/* Reveal: only hides content once JS has marked the page as motion-capable. */
.js-motion .reveal { opacity: 0; transform: translateY(8px); transition: opacity 280ms ease-out, transform 280ms ease-out; }
.js-motion .reveal.is-visible { opacity: 1; transform: none; }

@keyframes sv-light-up {
  0% { opacity: 0.25; filter: drop-shadow(0 0 0 transparent); }
  35% { opacity: 1; filter: drop-shadow(0 0 18px var(--neon-glow)); }
  45% { opacity: 0.55; }
  60%, 100% { opacity: 1; filter: drop-shadow(0 0 10px var(--neon-glow)); }
}
.hero-mark { animation: sv-light-up 900ms ease-out 150ms 1 both; }

@media (prefers-reduced-motion: reduce) {
  .hero-mark { animation: none; filter: drop-shadow(0 0 10px var(--neon-glow)); }
  .js-motion .reveal { opacity: 1; transform: none; }
}
```
(The existing reduced-motion block in global.css already zeroes animations/transitions; keep it after this block or merge them.)

`src/components/Reveal.astro`:
```astro
<script>
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-motion');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }
</script>
```

In `BaseLayout.astro`, import `Reveal` and render `<Reveal />` just before `</body>`. In `index.astro`, add `reveal` to the class list of the sections after the hero (`home-upcoming`, `ways-wrap`, `loved`, `founder`). Add `reveal` to the grid sections on `classes`, `learn`, `about`.

- [ ] **Step 4: Run the full suites**

Run: `npx vitest run && npx playwright test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: neon light-up hero and scroll reveals, reduced-motion safe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After the plan

The controller runs a final design-engineering review of the built site using the `emil-design-eng` skill (and `review-animations` for Task 15), applies agreed fixes as a follow-up task, then uses superpowers:finishing-a-development-branch.
