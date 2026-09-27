const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Instagram only issues a new long-lived token when the current one is at
 * least 24h old, and only lets it be refreshed again after that. Attempting a
 * refresh on every run (twice daily) throws on the runs that are too soon
 * after the last one, which used to fail the whole sync. Refresh at most
 * once a week instead.
 */
export function shouldRefreshToken(lastRefreshedAt: string | null, now: Date): boolean {
  if (!lastRefreshedAt) return true;
  return now.getTime() - Date.parse(lastRefreshedAt) >= SEVEN_DAYS_MS;
}
