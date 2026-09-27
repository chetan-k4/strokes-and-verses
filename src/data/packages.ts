export type Package = { name: 'First Strokes' | 'Full Canvas'; classes: number; minutesPerClass: 60; price: number; wasPrice?: number; summary: string; points: string[] };

export const packages: Package[] = [
  {
    name: 'First Strokes', classes: 8, minutesPerClass: 60, price: 4000,
    summary: 'Small artworks to learn the basics, one skill at a time.',
    points: ['Drawing and sketching', 'Acrylic and watercolour basics', 'A small practice artwork most classes'],
  },
  {
    name: 'Full Canvas', classes: 15, minutesPerClass: 60, price: 7000, wasPrice: 7500,
    summary: "Take a larger canvas from first sketch to finished piece, under Balpreet's supervision.",
    points: ['Everything in First Strokes', 'One larger canvas project, start to finish', 'Guided composition, colour and finishing'],
  },
];
