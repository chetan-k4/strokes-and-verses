export function joinBase(base: string, path: string): string {
  const b = base.endsWith('/') ? base : base + '/';
  return b + path.replace(/^\//, '');
}

export function url(path: string): string {
  return joinBase(import.meta.env.BASE_URL ?? '/', path);
}
