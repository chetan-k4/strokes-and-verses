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
