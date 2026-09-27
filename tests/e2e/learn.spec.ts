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
