import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { sessionCookieName } from '@/lib/auth/session-cookie';
import { readStalwartAuthContextFromStore } from '@/lib/stalwart/auth-context';

export interface StalwartCredentials {
  /** URL for Stalwart management API calls (uses STALWART_API_URL if set, otherwise serverUrl) */
  apiUrl: string;
  /** URL of the JMAP server (for JMAP operations like password verification) */
  serverUrl: string;
  authHeader: string;
  username: string;
  hasSessionCookie: boolean;
  slot: number;
}

/**
 * Resolve the base URL for Stalwart management API requests.
 *
 * When the JMAP server sits behind a reverse proxy that only forwards
 * JMAP paths, the `/api/account/*` and `/api/principal/*` management
 * endpoints may not be exposed.  In that case, operators can set
 * `STALWART_API_URL` to point directly at the Stalwart HTTP listener
 * (e.g. `https://admin.example.com`).
 */
function getStalwartApiUrl(jmapServerUrl: string): string {
  const url = process.env.STALWART_API_URL || jmapServerUrl;
  return url.replace(/\/+$/, '');
}

/**
 * Extract credentials from the incoming request.
 *
 * Credentials are read from a verified, httpOnly auth-context cookie that is
 * populated after a successful JMAP login or token refresh.
 */
function parseSlot(raw: string | null): number | null {
  if (raw === null) return null;
  const slot = parseInt(raw, 10);
  return Number.isNaN(slot) || slot < 0 || slot > 4 ? null : slot;
}

function getCandidateSlots(request: NextRequest): number[] {
  const requestedSlot = parseSlot(request.headers.get('X-JMAP-Cookie-Slot'))
    ?? parseSlot(request.nextUrl.searchParams.get('slot'));

  return requestedSlot === null ? [0, 1, 2, 3, 4] : [requestedSlot];
}

export async function getStalwartCredentials(request: NextRequest): Promise<StalwartCredentials | null> {
  const cookieStore = await cookies();

  for (const slot of getCandidateSlots(request)) {
    const context = readStalwartAuthContextFromStore(cookieStore, slot);
    if (!context) continue;

    return {
      apiUrl: getStalwartApiUrl(context.serverUrl),
      serverUrl: context.serverUrl,
      authHeader: context.authHeader,
      username: context.username,
      hasSessionCookie: !!cookieStore.get(sessionCookieName(slot))?.value,
      slot,
    };
  }

  return null;
}
