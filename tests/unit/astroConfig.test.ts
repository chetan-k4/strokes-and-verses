import { describe, it, expect, afterEach, vi } from 'vitest';

describe('astro.config.mjs', () => {
  const originalSite = process.env.SITE_URL;
  const originalBase = process.env.BASE_PATH;

  afterEach(() => {
    if (originalSite === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = originalSite;
    if (originalBase === undefined) delete process.env.BASE_PATH; else process.env.BASE_PATH = originalBase;
  });

  it('falls back to the default site and base when GitHub vars are set but empty (unset repo variables)', async () => {
    process.env.SITE_URL = '';
    process.env.BASE_PATH = '';
    vi.resetModules();
    const config = (await import('../../astro.config.mjs')).default;
    expect(config.site).toBe('https://strokesandverses.github.io');
    expect(config.base).toBe('/');
  });

  it('still uses real values when the vars are set', async () => {
    process.env.SITE_URL = 'https://example.com';
    process.env.BASE_PATH = '/repo/';
    vi.resetModules();
    const config = (await import('../../astro.config.mjs')).default;
    expect(config.site).toBe('https://example.com');
    expect(config.base).toBe('/repo/');
  });
});
