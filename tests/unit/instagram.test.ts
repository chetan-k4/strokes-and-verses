import { describe, it, expect } from 'vitest';
import { fetchRecentMedia, refreshToken } from '../../scripts/instagram-sync/instagram';

const ok = (json: unknown, check?: (u: URL) => void) => (async (input: RequestInfo | URL) => {
  check?.(new URL(String(input)));
  return new Response(JSON.stringify(json));
}) as typeof fetch;

describe('fetchRecentMedia', () => {
  it('requests the right fields and normalises media', async () => {
    const media = await fetchRecentMedia('TOKEN123', ok({ data: [
      { id: '1', caption: 'hi', media_type: 'VIDEO', thumbnail_url: 'https://t/1.jpg', media_url: 'https://v/1.mp4', permalink: 'https://www.instagram.com/reel/1/', timestamp: '2026-09-12T12:30:00+0000' },
      { id: '2', media_type: 'IMAGE', media_url: 'https://i/2.jpg', permalink: 'https://www.instagram.com/p/2/', timestamp: '2026-09-11T12:30:00+0000' },
    ] }, (u) => {
      expect(u.pathname).toMatch(/\/me\/media$/);
      expect(u.searchParams.get('fields')).toBe('id,caption,media_type,media_url,thumbnail_url,permalink,timestamp');
      expect(u.searchParams.get('limit')).toBe('25');
    }));
    expect(media).toEqual([
      { id: '1', caption: 'hi', mediaType: 'VIDEO', imageUrl: 'https://t/1.jpg', permalink: 'https://www.instagram.com/reel/1/', timestamp: '2026-09-12T18:00:00+05:30' },
      { id: '2', caption: '', mediaType: 'IMAGE', imageUrl: 'https://i/2.jpg', permalink: 'https://www.instagram.com/p/2/', timestamp: '2026-09-11T18:00:00+05:30' },
    ]);
  });
  it('throws a useful error without leaking the token', async () => {
    const bad = (async () => new Response(JSON.stringify({ error: { message: 'Invalid OAuth access token' } }), { status: 400 })) as typeof fetch;
    await expect(fetchRecentMedia('SECRET_TOKEN', bad)).rejects.toThrow(/Instagram API 400: Invalid OAuth access token/);
    await expect(fetchRecentMedia('SECRET_TOKEN', bad)).rejects.not.toThrow(/SECRET_TOKEN/);
  });
});

describe('refreshToken', () => {
  it('returns the refreshed token', async () => {
    expect(await refreshToken('OLD', ok({ access_token: 'NEW', expires_in: 5184000 }, (u) => {
      expect(u.pathname).toBe('/refresh_access_token');
      expect(u.searchParams.get('grant_type')).toBe('ig_refresh_token');
    }))).toBe('NEW');
  });
});
