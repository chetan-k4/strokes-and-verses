import type { ImageMetadata } from 'astro';
import kinusaiga from '../assets/art-forms/kinusaiga.webp';
import pearl from '../assets/art-forms/pearl-art.webp';
import texture from '../assets/art-forms/texture-impasto.webp';
import cloth from '../assets/art-forms/cloth-texture.webp';
import tin from '../assets/art-forms/tin-embossing.webp';
import mirror from '../assets/art-forms/boho-mirror.webp';
import boho from '../assets/art-forms/boho-acrylic.webp';
import glass from '../assets/art-forms/acrylic-glass.webp';
import acrylic from '../assets/art-forms/acrylic-painting.webp';

export type ArtForm = { slug: string; name: string; shortName: string; hours: number; price: number; includesNote: string; image: ImageMetadata; alt: string };

export const artForms: ArtForm[] = [
  { slug: 'kinusaiga', name: 'Kinusaiga', shortName: 'Kinusaiga', hours: 2, price: 1400, includesNote: 'Materials and frame included', image: kinusaiga, alt: 'A framed Kinusaiga fabric mosaic portrait held up in front of the neon Strokes & Verses sign' },
  { slug: 'pearl-art', name: 'Pearl Art', shortName: 'Pearl Art', hours: 2, price: 1399, includesNote: 'Materials included · one complete painting', image: pearl, alt: 'Three pearl art seascapes with sunset skies, held up in the studio' },
  { slug: 'texture-impasto', name: 'Texture Art (Impasto)', shortName: 'Texture Art', hours: 2, price: 1299, includesNote: 'Materials included', image: texture, alt: 'Thick impasto sunflowers on a square canvas on a wooden shelf' },
  { slug: 'cloth-texture', name: 'Cloth Texture Art', shortName: 'Cloth Texture Art', hours: 3.5, price: 2800, includesNote: 'Materials included', image: cloth, alt: 'A textured canvas with draped cloth in peach holding a bunch of yellow flowers' },
  { slug: 'tin-embossing', name: 'Tin Embossing', shortName: 'Tin Embossing', hours: 2, price: 1299, includesNote: 'Materials included', image: tin, alt: 'Embossed silver tin moon, horse, leaf and fish on a blue painted board' },
  { slug: 'boho-mirror', name: 'Boho Mirror Decoration', shortName: 'Boho Mirror', hours: 2, price: 1299, includesNote: 'Materials included', image: mirror, alt: 'A round jute rope mirror decorated with pearls and shells on the studio wall' },
  { slug: 'boho-acrylic', name: 'Boho Acrylic Painting', shortName: 'Boho Acrylic', hours: 2, price: 1199, includesNote: 'Materials included', image: boho, alt: 'A boho line-art face among tropical leaves in green, coral and pink' },
  { slug: 'acrylic-glass', name: 'Acrylic Glass Painting', shortName: 'Glass Painting', hours: 2, price: 1199, includesNote: 'Materials included', image: glass, alt: 'A glass painting of a yellow crescent moon and pink flowers held against the sky' },
  { slug: 'acrylic-painting', name: 'Acrylic Painting', shortName: 'Acrylic Painting', hours: 2, price: 1199, includesNote: 'Materials included', image: acrylic, alt: 'An acrylic painting of a blue arched door under pink bougainvillea' },
];

export function artFormByName(name: string): ArtForm | undefined {
  const n = name.trim().toLowerCase();
  return artForms.find((a) => a.name.toLowerCase() === n || a.shortName.toLowerCase() === n);
}
