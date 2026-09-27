import { describe, it, expect } from 'vitest';
import { artForms, artFormByName } from '../../src/data/artForms';
import { packages } from '../../src/data/packages';

describe('artForms', () => {
  it('lists the nine one-off classes with the agreed prices', () => {
    expect(artForms.map((a) => [a.name, a.hours, a.price])).toEqual([
      ['Kinusaiga', 2, 1400],
      ['Pearl Art', 2, 1399],
      ['Texture Art (Impasto)', 2, 1299],
      ['Cloth Texture Art', 3.5, 2800],
      ['Tin Embossing', 2, 1299],
      ['Boho Mirror Decoration', 2, 1299],
      ['Boho Acrylic Painting', 2, 1199],
      ['Acrylic Glass Painting', 2, 1199],
      ['Acrylic Painting', 2, 1199],
    ]);
  });
  it('finds by name case-insensitively and by short name', () => {
    expect(artFormByName('kinusaiga')?.slug).toBe('kinusaiga');
    expect(artFormByName('Texture Art')?.slug).toBe('texture-impasto');
    expect(artFormByName('Paper Collage')).toBeUndefined();
  });
});

describe('packages', () => {
  it('First Strokes and Full Canvas', () => {
    expect(packages.map((p) => [p.name, p.classes, p.price, p.wasPrice])).toEqual([
      ['First Strokes', 8, 4000, undefined],
      ['Full Canvas', 15, 7000, 7500],
    ]);
  });
});
