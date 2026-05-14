const ZOHO_TOKEN_URL = 'https://accounts.zoho.eu/oauth/v2/token';

interface TokenCache {
  token: string;
  expiresAt: number;
}

// Module-level cache — persists across requests in the same Worker isolate.
// Cloudflare Workers are long-lived; this avoids hitting the token endpoint on every request.
let cache: TokenCache | null = null;

export async function getZohoAccessToken(env: {
  ZOHO_CLIENT_ID?: string;
  ZOHO_CLIENT_SECRET?: string;
  ZOHO_REFRESH_TOKEN?: string;
}): Promise<string> {
  if (cache && Date.now() < cache.expiresAt) {
    return cache.token;
  }

  const { ZOHO_CLIENT_ID: clientId, ZOHO_CLIENT_SECRET: clientSecret, ZOHO_REFRESH_TOKEN: refreshToken } = env;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Zoho OAuth credentials not configured');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(ZOHO_TOKEN_URL, { method: 'POST', body: params });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho token request failed: ${res.status} — ${body}`);
  }

  const data = await res.json() as Record<string, unknown>;
  const token = data.access_token as string | undefined;
  if (!token) throw new Error('Zoho token response missing access_token');

  // Log the full response so we can detect refresh token rotation
  if (data.refresh_token) {
    console.warn('[zoho-token] Zoho returned a NEW refresh_token — update ZOHO_REFRESH_TOKEN in secrets:', data.refresh_token);
  }

  // Cache for 55 minutes (Zoho access tokens last 1 hour)
  cache = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return token;
}
