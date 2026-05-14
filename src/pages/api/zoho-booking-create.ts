export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getZohoAccessToken } from '../../lib/zoho-token';

interface BookingRequestBody {
  name?: unknown;
  email?: unknown;
  date?: unknown;
  time?: unknown;
  message?: unknown;
  _trap?: unknown;
}

interface ZohoBookingResponse {
  response?: {
    returnvalue?: {
      booking_id?: string;
      bookingid?: string;
      status?: string;
      message?: string;
    };
    status?: string;
  };
}

const ZOHO_BOOKINGS_BASE = 'https://www.zohoapis.eu/bookings/v1';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(?::\d{2})?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Combine date (YYYY-MM-DD) and time (HH:mm or HH:mm:ss) into a Zoho-compatible
 * starttime string: `dd-MMM-yyyy HH:mm:ss`. Zoho Bookings v1 expects this format.
 * Returns null if either input is invalid.
 */
function buildZohoStartTime(date: string, time: string): string | null {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return null;

  const [yearStr, monthStr, dayStr] = date.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const timeParts = time.split(':');
  const hh = String(Number.parseInt(timeParts[0], 10)).padStart(2, '0');
  const mm = String(Number.parseInt(timeParts[1], 10)).padStart(2, '0');
  const ss = timeParts[2] ? String(Number.parseInt(timeParts[2], 10)).padStart(2, '0') : '00';

  return `${String(day).padStart(2, '0')}-${months[month - 1]}-${year} ${hh}:${mm}:${ss}`;
}

export const POST: APIRoute = async ({ request }) => {

  let body: BookingRequestBody;
  try {
    body = await request.json() as BookingRequestBody;
  } catch {
    return jsonResponse({ ok: false, message: 'Please check your details and try again.' }, 400);
  }

  // Honeypot — silently accept and discard
  if (body._trap !== undefined && body._trap !== null && body._trap !== '') {
    return jsonResponse({ ok: true }, 200);
  }

  const name = asTrimmedString(body.name);
  const email = asTrimmedString(body.email);
  const date = asTrimmedString(body.date);
  const time = asTrimmedString(body.time);
  const message = asTrimmedString(body.message);

  if (!name) {
    return jsonResponse({ ok: false, message: 'Please check your details and try again.' }, 422);
  }
  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ ok: false, message: 'Please check your details and try again.' }, 422);
  }
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) {
    return jsonResponse({ ok: false, message: 'Please check your details and try again.' }, 422);
  }

  const service = import.meta.env.PUBLIC_ZOHO_BOOKING_SERVICE ?? '';
  if (!service) {
    return jsonResponse({ ok: false, message: 'Booking service temporarily unavailable' }, 200);
  }

  const starttime = buildZohoStartTime(date, time);
  if (!starttime) {
    return jsonResponse({ ok: false, message: 'Please check your details and try again.' }, 422);
  }

  let token: string;
  try {
    token = await getZohoAccessToken(env);
  } catch {
    return jsonResponse({ ok: false, message: 'Booking service temporarily unavailable' }, 200);
  }

  const staffId = import.meta.env.PUBLIC_ZOHO_BOOKING_STAFF_ID ?? '-1';
  const customerDetails: Record<string, string> = { name, email };
  if (message) customerDetails.notes = message;

  // Zoho Bookings v1 appointment creation uses multipart/form-data.
  const formData = new FormData();
  formData.set('service_id', service);
  formData.set('staff_id', staffId);
  formData.set('from_time', starttime);
  formData.set('timezone', 'Europe/Berlin');
  formData.set('customer_details', JSON.stringify(customerDetails));

  console.log('[zoho-create] token:', token);
  console.log('[zoho-create] from_time:', starttime, 'customer_details:', JSON.stringify(customerDetails));
  try {
    const res = await fetch(`${ZOHO_BOOKINGS_BASE}/json/appointment`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        Accept: 'application/json',
      },
      body: formData,
    });

    const rawBody = await res.text();
    console.log('[zoho-create] status:', res.status, 'body:', rawBody);

    if (!res.ok) {
      return jsonResponse({ ok: false, message: 'Booking service temporarily unavailable' }, 200);
    }

    const payload = JSON.parse(rawBody) as ZohoBookingResponse;
    const rv = payload.response?.returnvalue;
    const bookingId = rv?.booking_id ?? rv?.bookingid ?? '';
    // rv.status is the actual booking result; response.status is always "success" when the request was processed
    const rvStatus = (rv?.status ?? '').toLowerCase();

    if (rvStatus === 'failure' || (!bookingId && rvStatus !== 'success')) {
      console.log('[zoho-create] booking rejected by Zoho, rv:', JSON.stringify(rv));
      return jsonResponse({ ok: false, message: 'Booking service temporarily unavailable' }, 200);
    }

    return jsonResponse({ ok: true, booking_id: bookingId }, 200);
  } catch (err) {
    console.log('[zoho-create] error:', err);
    return jsonResponse({ ok: false, message: 'Booking service temporarily unavailable' }, 200);
  }
};
