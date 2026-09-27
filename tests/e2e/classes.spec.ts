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
