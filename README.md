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

## First run and red runs
- **First run:** the checker reads the last 25 Instagram posts. Past workshops fill in under "Recently" on the Workshops page; a few unclear older posts may still open as **Draft: …** issues — just `discard` any that are too old to matter.
- **A red (failed) run:** open the run on GitHub → Actions → Instagram sync, and click **Re-run all jobs**. Most failures clear up on a retry.
- **An `alert` issue:** appears after two failed runs in a row. This is almost always the Instagram token expiring — create a new long-lived token and replace the `IG_ACCESS_TOKEN` secret (see setup step 2 below).

## One-time setup (all free)
1. **Pages:** Settings → Pages → Source: GitHub Actions. Until the domain is connected, set repo variable `BASE_PATH` to `/<repo-name>/` and `SITE_URL` to `https://<user>.github.io`.
2. **Instagram token:** create a Meta developer app → add "Instagram API with Instagram Login" → generate a long-lived token for @strokesandverses → save as repo secret `IG_ACCESS_TOKEN`.
3. **Token renewal:** create a fine-grained GitHub token for this repo only with "Secrets: Read and write" → save as repo secret `IG_TOKEN_PAT`.
4. **Labels:** create `draft`, `publish`, `discard`, `alert`.
5. **Notifications:** Watch the repo (Custom → Issues). Add Balpreet as a collaborator so she gets the emails too.
6. **Domain:** Settings → Pages → Custom domain; set `BASE_PATH` to `/` and `SITE_URL` to your domain.

## Developing
npm ci · npm run dev · npm test · npm run test:e2e · npm run tokens (after changing content/brand/tokens.json)
