# Strokes & Verses Website — Design Spec

Date: 2026-09-28 · Owner: Chetan · Maintainer: Balpreet (via Instagram only)

## 1. Goal

A website for Strokes & Verses, Balpreet Kaur's art studio in Sector 37-B, Chandigarh, that:

1. Presents the studio's workshops, one-off classes, learner packages, founder and upcoming shop.
2. Keeps its workshop calendar up to date **without Balpreet doing anything beyond posting on Instagram**.
3. Sends every booking to WhatsApp.

Success: a workshop posted on Instagram appears on the site within 12 hours with correct date, time and details, or reaches the owners as a one-tap draft; every Book button opens WhatsApp with a correct pre-filled message; the site passes accessibility checks and renders without horizontal scroll at 360px.

## 2. Brand source

Design system artifact: https://claude.ai/artifact/USxG9T1V5gwjWqrimjJuYE (project/README.md, project/tokens.json, logo/motif SVG assets).

- Tokens: colours (`canvas`, `paper`, `blush`, `blush-soft`, `neon`, `neon-glow`, `on-neon`, `ink`, `ink-muted`, `on-blush`, `sunflower`, `on-sunflower`, `line`, `line-strong`, `focus-ring`) in two themes: `studio` (default) and `neon-night` (hero, shop, dark sections). Spacing `space-1…16`, radius `sm/md/lg/pill`, shadows `soft/glow`.
- Type: Sacramento (script, ≥40px, never a sentence), Fraunces (display/headline/title-italic), Bricolage Grotesque (body, label, poster).
- Assets: `sv-mark-*`, `sv-wordmark-*`, `sv-monogram-*` (favicon), `sv-blossom-*` SVGs, copied exactly, never redrawn.
- Rules carried into the build: name always "Strokes & Verses"; "Kinusaiga" spelling; neon never on blush; `shadow-glow` once per layout; focus is 2px solid `focus-ring`, 2px offset; round shapes (pill buttons, circular date stamps, circle photo crops); ✨ 🌻 at most as accents.

## 3. Content

Source of truth during build: `content/intake.md` and `content/art-forms/*.webp`, `content/photos/*`.

### 3.1 Art forms (one-off classes, per person, materials included)

| Art form | Duration | Price |
|---|---|---|
| Boho Acrylic Painting | 2 h | ₹1,199 |
| Texture Art (Impasto) | 2 h | ₹1,299 |
| Cloth Texture Art | 3.5 h | ₹2,800 |
| Acrylic Glass Painting | 2 h | ₹1,199 |
| Acrylic Painting | 2 h | ₹1,199 |
| Tin Embossing | 2 h | ₹1,299 |
| Boho Mirror Decoration | 2 h | ₹1,299 |
| Pearl Art (one complete painting) | 2 h | ₹1,399 |
| Kinusaiga (fabric mosaic, frame included) | 2 h | ₹1,400 |

- Private class: listed price, booked on WhatsApp.
- Group class / event: custom pricing, "Plan a group or event" on WhatsApp.

### 3.2 Learner packages (1-hour classes; painting materials not included)

- **First Strokes**: 8 classes, ₹4,000. Small artworks to learn the basics: drawing, sketching, acrylic, watercolour.
- **Full Canvas**: 15 classes, ~~₹7,500~~ ₹7,000. Finish a larger canvas project under Balpreet's supervision.

### 3.3 Contact

- WhatsApp (only number shown): +91 95016 90208 → `https://wa.me/919501690208?text=…`
- Instagram: https://www.instagram.com/strokesandverses/
- Address: 1066, Sector 37-B, Chandigarh 160036 · map https://maps.app.goo.gl/GLnZm4HAAXwFQrCx6

### 3.4 Founder

Light, visual About page from `content/intake.md` "About Balpreet": quote, 4-step timeline, 3 values, galleries/commissions line. Portrait: circle crop of `content/photos/hardy-sandhu-sip-paint.jpg` (left figure, identified by caption) until a dedicated portrait is supplied.

### 3.5 Social proof

Hardy Sandhu Sip & Paint private-party workshop, featured on Home ("Loved by").

## 4. Pages

| Route | Contents |
|---|---|
| `/` | Neon-night hero (mark with one-time neon light-up, tagline "Where art meets heart", Pearl Art photo); next 3 upcoming workshops; three ways to learn (Workshops / Classes / Learn); Hardy Sandhu feature; Balpreet intro → About; WhatsApp CTA |
| `/workshops` | Upcoming events as cards with circular date stamp, time, price or "Ask for fee", includes, image, "Book on WhatsApp"; "Recently" strip of past events (last 6); empty state: "New workshops are announced on Instagram first" + follow link |
| `/classes` | 9 art-form cards (photo, name, duration, price, "materials included"); each: "Book a private class" + "Plan a group or event" |
| `/learn` | First Strokes and Full Canvas cards; strikethrough price; materials note; "Enquire on WhatsApp" |
| `/about` | Portrait, quote, timeline, values, commissions line |
| `/shop` | Neon-night "Coming soon", blossom, one line on hand-painted utility pieces & wearables, Instagram follow |
| all | Header (wordmark, nav, mobile menu), footer (address + map, WhatsApp, Instagram, #StrokesAndVerses), floating WhatsApp button on mobile |

WhatsApp messages (pre-filled, English):
- Workshop: `Hi Balpreet, I'd like to book the {title} on {Day D Mon}, {time}.`
- Private class: `Hi Balpreet, I'd like to book a private {art form} class.`
- Group: `Hi Balpreet, I'd like to plan a group {art form} session for ___ people.`
- Package: `Hi Balpreet, I'm interested in the {First Strokes|Full Canvas} package.`
- General: `Hi Balpreet, I have a question about Strokes & Verses.`

Motion (Emil Kowalski principles): purposeful and restrained. Hero neon light-up once on load; soft fade/translate-in of sections (≤300ms, ease-out); button press scale 0.97; no bounce; everything disabled under `prefers-reduced-motion`.

## 5. Architecture

```
Instagram ──(Graph API, 2×/day)──▶ GitHub Action: instagram-sync
                                        │ extract (Claude Sonnet 5, caption+image)
                                        │ classify → live / draft / ignore
                                        │ dedupe  → create / update / skip
                                        ▼
                         commit src/content/events/*.json  ──▶ Vercel build ──▶ site
                                        │ (draft)
                                        ▼
                           Resend email ──▶ owner taps Publish/Discard
                                                   │
                                  Vercel function /api/review (HMAC-signed link)
                                                   │ GitHub API commit
                                                   ▼
                                              Vercel build
```

### 5.1 Site

- Astro (static output), TypeScript, no UI framework. Tokens → `src/styles/tokens.css` generated from a copied `tokens.json` (studio on `:root`, neon-night on `[data-theme="neon-night"]`).
- Content collection `events` (JSON, zod schema). Art forms and packages in `src/data/`.
- Upcoming/past split at build time and re-checked in the browser against the current IST date (so a stale build never shows a past event as upcoming).
- Images: `astro:assets` with responsive widths, WebP.
- Hosting: Vercel, connected to GitHub `main`. Domain connected later by Chetan.

### 5.2 Event schema

```ts
{
  id: string;                 // slug: {artform}-{yyyy-mm-dd}-{hhmm}
  status: "live" | "draft";
  title: string;              // "Kinusaiga Workshop"
  artForm: string;            // "Kinusaiga"
  start: string;              // ISO, Asia/Kolkata offset
  end: string | null;
  price: number | null;       // INR; null = "Ask for fee"
  includes: string[];         // ["All materials", "Frame", "Refreshments"]
  venue: string;              // default studio address
  description: string;        // 1–2 sentences, brand voice
  image: string | null;       // repo path to downloaded post image
  source: { postId: string; permalink: string; postedAt: string };
  sourcePostIds: string[];    // all posts merged into this event
}
```

Plus `data/instagram-state.json`: `{ seenPostIds: string[], lastRunAt, consecutiveFailures }`.

### 5.3 instagram-sync units (`scripts/instagram-sync/`)

| Unit | Input → Output |
|---|---|
| `instagram.ts` | token → latest 25 media (id, caption, media_url/thumbnail_url, permalink, timestamp, media_type); refresh long-lived token when older than 7 days, write back to GitHub secret |
| `extract.ts` | caption + image + today's date → `{ isAnnouncement, event?, confidence: "high"|"low", reasons[] }` via Claude tool-use with a strict JSON schema |
| `classify.ts` | extraction + today → `live` / `draft` / `ignore` (draft if confidence low, date missing/past, or start time missing) |
| `dedupe.ts` | candidate + existing events → `create` / `update(id)` / `skip` (match: same artForm + same local date + same start time; update keeps earliest id, merges sourcePostIds, newer fields win) |
| `store.ts` | read/write event files, image download, state file |
| `removal.ts` | a source post counts as deleted when its `postedAt` is newer than the oldest post in the latest fetch (so it should have appeared) and its id is absent. An upcoming event whose every source post is deleted → delete its file. Past events are never removed |
| `notify.ts` | draft → email to `OWNER_EMAILS` with signed Publish / Discard links; failure alert after 2 consecutive failed runs |
| `run.ts` | orchestrates; exit non-zero on failure; commits via `git` in the Action |

Shared: `src/lib/whatsappLink.ts`, `src/lib/eventDates.ts` (IST formatting, upcoming/past).

### 5.4 Workflow

`.github/workflows/instagram-sync.yml`: cron `30 2 * * *` and `30 14 * * *` (08:00 and 20:00 IST) + `workflow_dispatch`. Secrets: `IG_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `REVIEW_LINK_SECRET`, `GH_SECRETS_TOKEN` (to rotate IG token). Config (non-secret) in `site.config.ts`: `OWNER_EMAILS`, WhatsApp number, site URL.

### 5.5 Review function

`api/review.ts` on Vercel: `GET /api/review?id=…&action=publish|discard&exp=…&sig=…`. Verifies HMAC and expiry (14 days), then via GitHub API sets `status: "live"` or deletes the draft file. Returns a small branded confirmation page. Idempotent.

## 6. Error handling

- Instagram/Claude/network error → run fails, state `consecutiveFailures++`; on 2 → alert email. Nothing is written on a failed run (atomic: compute all changes, then write).
- Claude returns invalid JSON / schema mismatch → treat post as `draft` with reason "could not read".
- Image download fails → event saved with `image: null` (card shows blossom on blush-soft).
- Malformed event file (manual edit) → Astro schema error fails the Vercel build; the previous deployment stays live.
- Expired/invalid review link → friendly error page, no change.

## 7. Testing (TDD throughout)

- **Vitest unit tests** for every unit in 5.3 and `src/lib/*`. Fixtures: the real @strokesandverses captions (full text pulled during implementation) with expected outcomes:
  - Kinusaiga "BACK ON DEMAND" ×2 → one event, 19 Sept 2026 17:30–19:30 IST, price null.
  - "TWO art forms, ONE mindful Sunday" → Paper Collage + Denim Pocket event, 20 Sept 2026 15:30–17:30.
  - Kinusaiga 6 Sept 2026 → includes All materials, Frame, Refreshments; price null.
  - Thank-you posts, "Something beautiful is brewing" teaser, Hardy Sandhu recap → ignore.
- **Extraction** tested with recorded Claude responses (offline); `npm run test:live` re-runs fixtures against the real API.
- **Review function**: signature valid/invalid/expired, idempotency, GitHub API mocked.
- **Playwright** (360px and 1280px): all pages render; every Book button's `href` decodes to the expected WhatsApp text; calendar split with frozen clock; no horizontal overflow; mobile menu keyboard-operable.
- **Accessibility**: axe on every page, zero serious/critical violations.

## 8. Out of scope (v1)

Online payments, seat counts, chat-based event editing, shop checkout, CMS/admin UI, multi-language, the call-only number, art therapy and Panchkula/Mumbai pages.

## 9. Launch checklist (owner actions)

1. Create GitHub repo; connect Vercel.
2. Meta developer app → Instagram API with Instagram Login → long-lived token for @strokesandverses.
3. Anthropic API key, Resend account (verified sender domain once domain is bought).
4. Fill `OWNER_EMAILS` in `site.config.ts`; add secrets.
5. Buy domain, point to Vercel.
6. Optional: send a dedicated portrait of Balpreet.
