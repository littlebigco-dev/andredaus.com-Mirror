#!/usr/bin/env bun
/**
 * Zoho OAuth refresh token helper.
 *
 * One-time prerequisite: add http://localhost:3000/callback as an
 * Authorized Redirect URI in your Zoho API Console client settings.
 *
 * Usage:
 *   ZOHO_CLIENT_ID=1000.xxx ZOHO_CLIENT_SECRET=yyy bun scripts/zoho-auth.ts
 *
 * Or copy .env.local with real values and just run:
 *   bun scripts/zoho-auth.ts
 */

import { createServer } from 'http';
import { exec } from 'child_process';

// Load .env.local if present
const envFile = Bun.file('.env.local');
if (await envFile.exists()) {
  const lines = (await envFile.text()).split('\n');
  for (const line of lines) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing credentials. Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET.');
  console.error('Example: ZOHO_CLIENT_ID=1000.xxx ZOHO_CLIENT_SECRET=yyy bun scripts/zoho-auth.ts');
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = [
  'ZohoCRM.modules.leads.CREATE',
  'zohobookings.data.CREATE',  
].join(',');

const authUrl =
  `https://accounts.zoho.eu/oauth/v2/auth` +
  `?response_type=code` +
  `&client_id=${CLIENT_ID}` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&access_type=offline`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://localhost:3000');

  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    const msg = error ?? 'no code in redirect';
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h1 style="font-family:sans-serif">Error: ${msg}</h1><p>Check your terminal.</p>`);
    console.error('\nOAuth error:', msg);
    server.close();
    process.exit(1);
  }

  // Exchange code for tokens
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    redirect_uri: REDIRECT_URI,
    code,
  });

  const tokenRes = await fetch('https://accounts.zoho.eu/oauth/v2/token', {
    method: 'POST',
    body: params,
  });

  const data = (await tokenRes.json()) as Record<string, unknown>;

  if (data.error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h1 style="font-family:sans-serif">Token exchange failed: ${data.error}</h1><p>Check your terminal.</p>`);
    console.error('\nToken exchange failed:', data);
    server.close();
    process.exit(1);
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1 style="font-family:sans-serif;color:green">Done — check your terminal.</h1><p>You can close this tab.</p>');

  console.log('\n--- COPY THIS TO CLOUDFLARE PAGES ENV VARS ---\n');
  console.log(`ZOHO_CLIENT_ID=${CLIENT_ID}`);
  console.log(`ZOHO_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`ZOHO_REFRESH_TOKEN=${data.refresh_token}`);
  console.log('\n----------------------------------------------\n');

  server.close();
  process.exit(0);
});

server.listen(3000, () => {
  console.log('Opening Zoho authorization in your browser...');
  console.log('If the browser does not open, visit this URL manually:\n');
  console.log(authUrl + '\n');
  exec(`open "${authUrl}"`);
});
