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
