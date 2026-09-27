import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildTokensCss } from '../../scripts/build-tokens';

const tokens = JSON.parse(readFileSync('content/brand/tokens.json', 'utf8'));
const css = buildTokensCss(tokens);
const block = (sel: string) => css.split(sel + ' {')[1].split('}')[0];

describe('buildTokensCss', () => {
  it('puts studio colours on :root', () => {
    expect(block(':root')).toContain('--canvas: #fbf6ef;');
    expect(block(':root')).toContain('--neon: #c2185b;');
  });
  it('puts neon-night colours on the theme selector', () => {
    const night = block('[data-theme="neon-night"]');
    expect(night).toContain('--canvas: #1c1616;');
    expect(night).toContain('--neon: #ff5ca8;');
  });
  it('resolves aliases to var()', () => {
    expect(block(':root')).toContain('--focus-ring: var(--neon);');
    expect(block('[data-theme="neon-night"]')).toContain('--focus-ring: var(--neon);');
  });
  it('emits spacing, radius, fonts and themed shadows', () => {
    const root = block(':root');
    expect(root).toContain('--space-4: 16px;');
    expect(root).toContain('--radius-pill: 999px;');
    expect(root).toContain('--font-script: Sacramento, "Brush Script MT", cursive;');
    expect(root).toContain('--shadow-glow: 0 0 0 1px rgba(194,24,91,0.20)');
    expect(block('[data-theme="neon-night"]')).toContain('--shadow-glow: 0 0 0 1px rgba(255,92,168,0.35)');
  });
  it('matches the committed tokens.css', () => {
    expect(readFileSync('src/styles/tokens.css', 'utf8')).toBe(css);
  });
});
