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
