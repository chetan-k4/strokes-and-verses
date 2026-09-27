const GRAPH = 'https://graph.instagram.com';
const FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';

export type IgMedia = { id: string; caption: string; mediaType: string; imageUrl: string | null; permalink: string; timestamp: string };

function toIst(ts: string): string {
  const d = new Date(ts.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  const ist = new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 19);
  return `${ist}+05:30`;
}

async function getJson(url: URL, fetchImpl: typeof fetch) {
  const res = await fetchImpl(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Instagram API ${res.status}: ${json?.error?.message ?? 'unknown error'}`);
  return json;
}

export async function fetchRecentMedia(token: string, fetchImpl: typeof fetch = fetch): Promise<IgMedia[]> {
  const url = new URL(`${GRAPH}/v23.0/me/media`);
  url.searchParams.set('fields', FIELDS);
  url.searchParams.set('limit', '25');
  url.searchParams.set('access_token', token);
  const json = await getJson(url, fetchImpl);
  return (json.data ?? []).map((m: any) => ({
    id: String(m.id),
    caption: m.caption ?? '',
    mediaType: m.media_type,
    imageUrl: (m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url) ?? null,
    permalink: m.permalink,
    timestamp: toIst(m.timestamp),
  }));
}

export async function refreshToken(token: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const url = new URL(`${GRAPH}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', token);
  return (await getJson(url, fetchImpl)).access_token;
}
