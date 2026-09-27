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
