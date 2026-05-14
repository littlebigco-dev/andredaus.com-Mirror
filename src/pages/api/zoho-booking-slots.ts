export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getZohoAccessToken } from '../../lib/zoho-token';

/**
 * Zoho Bookings "available slots" response shape — we accept several
 * documented shapes and normalise to a string[] of UTC ISO datetimes.
 *
 * Documented (Zoho Bookings v1):
 *   { response: { returnvalue: { data: ["09:00 AM", ...] } } }
 *   { response: { returnvalue: { "2026-05-09": ["09:00", ...] } } }
 * We also tolerate an already-normalised `slots: string[]` to be defensive.
 */
interface ZohoSlotsResponse {
  response?: {
    returnvalue?: unknown;
    status?: string;
  };
  slots?: unknown;
}

const ZOHO_BOOKINGS_BASE = 'https://www.zohoapis.eu/bookings/v1';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toZohoDate(date: string, time: string): string {
  const [y, m, d] = date.split('-');
  return `${d.padStart(2, '0')}-${MONTHS[Number(m) - 1]}-${y} ${time}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Combine a date string and a time fragment into an ISO 8601 UTC datetime.
 * Accepts time fragments like "09:00", "09:00:00", "9:00 AM", "13:30".
 * Returns null if the time fragment cannot be parsed — the caller filters those out.
 *
 * Zoho Bookings returns slot times in the workspace's local timezone. We store
 * them as timezone-naive ISO strings ("YYYY-MM-DDTHH:mm:ss", no Z) so the
 * browser treats them as local time and displays them without offset conversion.
 */
function buildSlotIso(date: string, timeFragment: string): string | null {
  const trimmed = timeFragment.trim();
  if (!trimmed) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  // Already a full ISO datetime? Strip timezone suffix and return bare local.
  if (trimmed.includes('T')) {
    const bare = trimmed.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(bare) ? bare : null;
  }

  // 12-hour with AM/PM
  const ampmMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(trimmed);
  if (ampmMatch) {
    let hour = Number.parseInt(ampmMatch[1], 10);
    const minute = Number.parseInt(ampmMatch[2], 10);
    const second = ampmMatch[3] ? Number.parseInt(ampmMatch[3], 10) : 0;
    const meridiem = ampmMatch[4].toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    if (hour > 23 || minute > 59 || second > 59) return null;
    return `${date}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
  }

  // 24-hour
  const hhmmMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (hhmmMatch) {
    const hour = Number.parseInt(hhmmMatch[1], 10);
    const minute = Number.parseInt(hhmmMatch[2], 10);
    const second = hhmmMatch[3] ? Number.parseInt(hhmmMatch[3], 10) : 0;
    if (hour > 23 || minute > 59 || second > 59) return null;
    return `${date}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
  }

  return null;
}

/**
 * Normalise the heterogeneous Zoho slots payload into a sorted, deduplicated
 * array of timezone-naive ISO strings ("YYYY-MM-DDTHH:mm:ss"). Returns an
 * empty array on any unexpected shape — surfaces "no slots" rather than failing.
 */
function normaliseSlots(payload: ZohoSlotsResponse, date: string): string[] {
  const collected: string[] = [];

  const rv = payload.response?.returnvalue;

  if (Array.isArray(rv)) {
    for (const item of rv) {
      if (typeof item === 'string') {
        const iso = buildSlotIso(date, item);
        if (iso) collected.push(iso);
      }
    }
  } else if (rv && typeof rv === 'object') {
    const obj = rv as Record<string, unknown>;

    // Shape: { data: [...] }
    if (Array.isArray(obj.data)) {
      for (const item of obj.data) {
        if (typeof item === 'string') {
          const iso = buildSlotIso(date, item);
          if (iso) collected.push(iso);
        }
      }
    }

    // Shape: { "YYYY-MM-DD": ["HH:mm", ...] }
    for (const [key, value] of Object.entries(obj)) {
      if (DATE_RE.test(key) && Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') {
            const iso = buildSlotIso(key, item);
            if (iso) collected.push(iso);
          }
        }
      }
    }
  }

  // Defensive: caller may have already flattened.
  if (Array.isArray(payload.slots)) {
    for (const item of payload.slots) {
      if (typeof item === 'string') {
        const iso = buildSlotIso(date, item);
        if (iso) collected.push(iso);
      }
    }
  }

  // Dedupe + sort ascending.
  return Array.from(new Set(collected)).sort();
}

export const GET: APIRoute = async ({ url }) => {

  const date = url.searchParams.get('date') ?? '';
  console.log('[zoho-slots] handler called, date:', date);

  if (!DATE_RE.test(date)) {
    return jsonResponse({ slots: [], error: 'Invalid date parameter' }, 200);
  }

  const workspace = import.meta.env.PUBLIC_ZOHO_BOOKING_WORKSPACE ?? '';
  const service = import.meta.env.PUBLIC_ZOHO_BOOKING_SERVICE ?? '';
  console.log('[zoho-slots] workspace:', workspace || '(empty)', 'service:', service || '(empty)');
  if (!workspace || !service) {
    return jsonResponse({ slots: [], error: 'Booking service not configured' }, 200);
  }

  let token: string;
  try {
    token = await getZohoAccessToken(env);
    console.log('[zoho-slots] token ok, length:', token.length);
  } catch (err) {
    console.log('[zoho-slots] token failed:', err);
    return jsonResponse({ slots: [], error: 'Booking service temporarily unavailable' }, 200);
  }

  const selectedDate = toZohoDate(date, '00:00:00').split(' ')[0]; // dd-MMM-yyyy
  const endpoint = new URL(`${ZOHO_BOOKINGS_BASE}/json/availableslots`);
  const staffId = import.meta.env.PUBLIC_ZOHO_BOOKING_STAFF_ID ?? '-1';
  endpoint.searchParams.set('service_id', service);
  endpoint.searchParams.set('staff_id', staffId);
  endpoint.searchParams.set('selected_date', selectedDate);

  console.log('[zoho-slots] fetching:', endpoint.toString());
  try {
    const res = await fetch(endpoint.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.log('[zoho-slots] Zoho error status:', res.status, 'body:', errBody);
      return jsonResponse({ slots: [], error: 'Booking service temporarily unavailable' }, 200);
    }

    const payload = await res.json() as ZohoSlotsResponse;
    console.log('[zoho-slots] raw payload:', JSON.stringify(payload));
    const slots = normaliseSlots(payload, date);
    return jsonResponse({ slots }, 200);
  } catch {
    return jsonResponse({ slots: [], error: 'Booking service temporarily unavailable' }, 200);
  }
};
