import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { decryptSession } from '@/lib/auth/crypto';
import { sessionCookieName } from '@/lib/auth/session-cookie';
import { saveUserSettings, loadUserSettings, deleteUserSettings } from '@/lib/settings-sync';

function isEnabled(): boolean {
  return process.env.SETTINGS_SYNC_ENABLED === 'true' && !!process.env.SESSION_SECRET;
}

/**
 * Verify identity against session cookies across all account slots.
 * With multi-account, the requesting account may be on any slot (0-4).
 * Returns true if any slot matches OR if no session cookies exist at all.
 */
async function verifyIdentity(username: string, serverUrl: string): Promise<boolean> {
  const cookieStore = await cookies();
  let hasAnyCookie = false;

  for (let slot = 0; slot <= 4; slot++) {
    const token = cookieStore.get(sessionCookieName(slot))?.value;
    if (!token) continue;
    hasAnyCookie = true;

    const session = decryptSession(token);
    if (session && session.username === username && session.serverUrl === serverUrl) {
      return true; // Found a matching slot
    }
  }

  // No cookies at all → can't verify, allow (same-origin protection applies)
  if (!hasAnyCookie) return true;

  // Cookies exist but none matched → identity mismatch
  return false;
}

export async function GET(request: NextRequest) {
  if (!isEnabled()) {
    return NextResponse.json({ error: 'Settings sync is disabled' }, { status: 404 });
  }

  const username = request.headers.get('x-settings-username');
  const serverUrl = request.headers.get('x-settings-server');
  if (!username || !serverUrl) {
    return NextResponse.json({ error: 'Missing identity headers' }, { status: 400 });
  }

  if (!(await verifyIdentity(username, serverUrl))) {
    return NextResponse.json({ error: 'Identity mismatch' }, { status: 403 });
  }

  try {
    const settings = await loadUserSettings(username, serverUrl);
    return NextResponse.json({ settings: settings || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = (error as NodeJS.ErrnoException).code;
    logger.error('Settings load error', { error: message, code });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isEnabled()) {
    return NextResponse.json({ error: 'Settings sync is disabled' }, { status: 404 });
  }

  try {
    const { username, serverUrl, settings } = await request.json();
    if (!username || !serverUrl || !settings) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
      return NextResponse.json({ error: 'Settings must be an object' }, { status: 400 });
    }

    if (!(await verifyIdentity(username, serverUrl))) {
      return NextResponse.json({ error: 'Identity mismatch' }, { status: 403 });
    }

    await saveUserSettings(username, serverUrl, settings);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = (error as NodeJS.ErrnoException).code;
    logger.error('Settings save error', { error: message, code });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isEnabled()) {
    return NextResponse.json({ error: 'Settings sync is disabled' }, { status: 404 });
  }

  try {
    const { username, serverUrl } = await request.json();
    if (!username || !serverUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!(await verifyIdentity(username, serverUrl))) {
      return NextResponse.json({ error: 'Identity mismatch' }, { status: 403 });
    }

    await deleteUserSettings(username, serverUrl);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Settings delete error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
