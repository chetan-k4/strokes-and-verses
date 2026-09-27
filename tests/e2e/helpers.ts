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
