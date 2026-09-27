const ALIASES: [RegExp, string][] = [
  [/kinu\s*-?\s*sai\s*-?\s*ga/gi, 'Kinusaiga'],
  [/pearl\s*art/gi, 'Pearl Art'],
  [/cloth\s*texture(\s*art)?/gi, 'Cloth Texture Art'],
  [/impasto|texture\s*art/gi, 'Texture Art'],
  [/(acrylic\s*)?glass\s*painting/gi, 'Acrylic Glass Painting'],
  [/boho\s*mirror|mirror\s*decoration/gi, 'Boho Mirror Decoration'],
  [/boho\s*acrylic(\s*painting)?/gi, 'Boho Acrylic Painting'],
  [/(tin\s*)?embossing/gi, 'Tin Embossing'],
  [/paper\s*collage/gi, 'Paper Collage'],
  [/denim/gi, 'Denim Pocket Frame'],
  [/acrylic\s*painting/gi, 'Acrylic Painting'],
];

export function matchArtForms(text: string): string[] {
  const taken: [number, number][] = [];
  const names: string[] = [];
  for (const [re, name] of ALIASES) {
    for (const m of text.matchAll(re)) {
      const s = m.index!;
      const e = s + m[0].length;
      if (taken.some(([a, b]) => s < b && e > a)) continue;
      taken.push([s, e]);
      if (!names.includes(name)) names.push(name);
    }
  }
  return names;
}
