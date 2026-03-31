import { cookies } from 'next/headers';
import { decryptPayload, encryptPayload } from '@/lib/auth/crypto';
import { getCookieOptions } from '@/lib/oauth/cookie-config';

const STALWART_AUTH_CONTEXT_COOKIE = 'jmap_stalwart_ctx';

export interface StalwartAuthContext {
  serverUrl: string;
  username: string;
  authHeader: string;
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export function stalwartAuthContextCookieName(slot: number): string {
  return slot === 0 ? STALWART_AUTH_CONTEXT_COOKIE : `${STALWART_AUTH_CONTEXT_COOKIE}_${slot}`;
}

function isValidContext(payload: unknown): payload is StalwartAuthContext {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return typeof candidate.serverUrl === 'string'
    && typeof candidate.username === 'string'
    && typeof candidate.authHeader === 'string';
}

function getSessionCookieOptions() {
  const { maxAge: _maxAge, ...cookieOptions } = getCookieOptions();
  return cookieOptions;
}

export function readStalwartAuthContextFromStore(
  cookieStore: CookieStore,
  slot: number,
): StalwartAuthContext | null {
  const token = cookieStore.get(stalwartAuthContextCookieName(slot))?.value;
  if (!token) return null;

  const payload = decryptPayload(token);
  return isValidContext(payload) ? payload : null;
}

export async function readStalwartAuthContext(slot: number): Promise<StalwartAuthContext | null> {
  const cookieStore = await cookies();
  return readStalwartAuthContextFromStore(cookieStore, slot);
}

export function setStalwartAuthContextInStore(
  cookieStore: CookieStore,
  slot: number,
  context: StalwartAuthContext,
): void {
  cookieStore.set(
    stalwartAuthContextCookieName(slot),
    encryptPayload(context as unknown as Record<string, unknown>),
    getSessionCookieOptions(),
  );
}

export async function setStalwartAuthContext(slot: number, context: StalwartAuthContext): Promise<void> {
  const cookieStore = await cookies();
  setStalwartAuthContextInStore(cookieStore, slot, context);
}

export function clearStalwartAuthContextInStore(cookieStore: CookieStore, slot: number): void {
  cookieStore.delete(stalwartAuthContextCookieName(slot));
}

export async function clearStalwartAuthContext(slot: number): Promise<void> {
  const cookieStore = await cookies();
  clearStalwartAuthContextInStore(cookieStore, slot);
}