import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { NextRequest, NextResponse } from 'next/server';

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB
const FETCH_TIMEOUT_MS = 15000;

const blockedAddressRanges = new BlockList();
blockedAddressRanges.addAddress('0.0.0.0');
blockedAddressRanges.addAddress('127.0.0.1');
blockedAddressRanges.addSubnet('10.0.0.0', 8);
blockedAddressRanges.addSubnet('172.16.0.0', 12);
blockedAddressRanges.addSubnet('192.168.0.0', 16);
blockedAddressRanges.addSubnet('169.254.0.0', 16);
blockedAddressRanges.addAddress('::', 'ipv6');
blockedAddressRanges.addAddress('::1', 'ipv6');
blockedAddressRanges.addSubnet('fc00::', 7, 'ipv6');
blockedAddressRanges.addSubnet('fe80::', 10, 'ipv6');

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[(.*)\]$/, '$1').toLowerCase();
}

function isBlockedIpAddress(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  const family = isIP(normalized);
  if (family === 4) {
    return blockedAddressRanges.check(normalized, 'ipv4');
  }
  if (family === 6) {
    return blockedAddressRanges.check(normalized, 'ipv6');
  }
  return false;
}

async function isValidExternalUrl(urlString: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return false;
  }

  const hostname = normalizeHostname(url.hostname);

  // Block private/internal hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.arpa') ||
    hostname.endsWith('.localdomain')
  ) {
    return false;
  }

  // Block URLs with credentials
  if (url.username || url.password) {
    return false;
  }

  if (isBlockedIpAddress(hostname)) {
    return false;
  }

  if (isIP(hostname)) {
    return true;
  }

  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) {
      return false;
    }
    return records.every((record) => !isBlockedIpAddress(record.address));
  } catch {
    return false;
  }

}

export async function POST(request: NextRequest) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { url } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  if (!(await isValidExternalUrl(url))) {
    return NextResponse.json({ error: 'Invalid or disallowed URL' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const MAX_REDIRECTS = 5;
    let currentUrl = url;
    let response: Response | undefined;

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      if (!(await isValidExternalUrl(currentUrl))) {
        clearTimeout(timeout);
        return NextResponse.json({ error: 'Redirect to disallowed URL' }, { status: 400 });
      }

      response = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/calendar, application/ics, text/plain, */*',
          'User-Agent': 'JMAP-Webmail/1.0 Calendar-Fetcher',
        },
        redirect: 'manual',
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          clearTimeout(timeout);
          return NextResponse.json({ error: 'Redirect without Location header' }, { status: 502 });
        }
        // Resolve relative redirects
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      break;
    }

    clearTimeout(timeout);

    if (!response || !response.ok) {
      return NextResponse.json(
        { error: `Remote server returned ${response?.status ?? 'unknown'}` },
        { status: 502 }
      );
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RESPONSE_SIZE) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar',
        'Content-Length': buffer.byteLength.toString(),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 502 });
  }
}
