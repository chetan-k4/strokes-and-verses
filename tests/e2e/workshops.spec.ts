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
