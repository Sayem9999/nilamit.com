import { NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const ALLOWED_HOSTS = [
  'lh3.googleusercontent.com',
  'avatars.githubusercontent.com',
  'platform-lookaside.fbsbx.com',
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const isGoogle = parsedUrl.hostname === 'googleusercontent.com' || parsedUrl.hostname.endsWith('.googleusercontent.com');
    if (!isGoogle && !ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
      return new NextResponse('Host not allowed', { status: 400 });
    }

    // Fetch the image from the secure server side (always returns 200)
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      log.warn('[Avatar Proxy] Failed to fetch target avatar', {
        url: targetUrl,
        status: res.status,
      });
      return new NextResponse('Failed to fetch avatar', { status: res.status });
    }

    const contentType = res.headers.get('Content-Type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    });
  } catch (err) {
    log.error('[Avatar Proxy] Exception occurred', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}
