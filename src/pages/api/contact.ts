export const prerender = false;

import type { APIRoute } from 'astro';

interface ZohoLead {
  Last_Name: string;
  First_Name?: string;
  Email: string;
  Phone?: string;
  Description?: string;
  Lead_Source: string;
}

interface ZohoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

async function getZohoToken(env: Record<string, string | undefined>): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.ZOHO_CLIENT_ID ?? '',
    client_secret: env.ZOHO_CLIENT_SECRET ?? '',
    refresh_token: env.ZOHO_REFRESH_TOKEN ?? '',
  });

  const res = await fetch('https://accounts.zoho.eu/oauth/v2/token', {
    method: 'POST',
    body: params,
  });

  if (!res.ok) {
    throw new Error(`Zoho token request failed: ${res.status}`);
  }

  const data = await res.json() as ZohoTokenResponse;
  return data.access_token;
}

async function createZohoLead(lead: ZohoLead, token: string): Promise<void> {
  const res = await fetch('https://www.zohoapis.eu/crm/v2/Leads', {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: [lead] }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho Leads API failed: ${res.status} — ${body}`);
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  // Cloudflare env is available on locals.runtime.env
  const env = (locals as { runtime?: { env?: Record<string, string | undefined> } }).runtime?.env ?? {};

  let body: FormData | null = null;
  try {
    body = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const name = (body.get('name') as string | null)?.trim() ?? '';
  const email = (body.get('email') as string | null)?.trim() ?? '';
  const message = (body.get('message') as string | null)?.trim() ?? '';
  const phone = (body.get('phone') as string | null)?.trim() ?? '';
  const honeypot = body.get('_trap');

  // Honeypot — bot submitted the hidden field
  if (honeypot) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Basic validation
  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: 'name, email, and message are required' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email address' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Forward to Zoho CRM
  try {
    const [firstName, ...rest] = name.split(' ');
    const lastName = rest.join(' ') || firstName;

    const lead: ZohoLead = {
      First_Name: firstName,
      Last_Name: lastName,
      Email: email,
      Phone: phone || undefined,
      Description: message,
      Lead_Source: 'Web Site',
    };

    const token = await getZohoToken(env);
    await createZohoLead(lead, token);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[contact API]', err);
    return new Response(JSON.stringify({ error: 'Failed to submit enquiry. Please try email instead.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
