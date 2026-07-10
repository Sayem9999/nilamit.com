/**
 * GET /api/share-card/{auctionId}
 *
 * Live auction share card — a 1200×630 PNG with the CURRENT bid, bid count,
 * and time remaining, branded for posting into Facebook groups / WhatsApp
 * (the GROWTH.md distribution playbook). Unlike /api/og (static params baked
 * at metadata time), this reads the auction live so a reposted card always
 * shows the real price.
 *
 * Status-aware: live renders "CURRENT BID + ends in…"; SOLD/AWAITING_PAYMENT
 * renders the result card ("SOLD FOR ৳X · N bids") — the post-sale trust
 * artifact the playbook says to share; anything else (expired, cancelled,
 * past end time) renders a neutral ENDED card that stops saying "Bid now".
 *
 * The photo is fetched server-side and embedded as a data URI: satori cannot
 * decode WebP (a format our uploads accept), and embedding also removes the
 * render-time dependency on Storage being reachable from the og renderer.
 * sharp (bundled with Next) normalizes any accepted format to a cover-cropped
 * JPEG; if sharp is unavailable we embed JPEG/PNG/GIF raw and skip WebP.
 *
 * Node runtime (not edge) on purpose: needs the Admin SDK for the live read.
 * Public data only (title/price/count/end-time/photo). Cached 5 minutes.
 */

import { ImageResponse } from 'next/og';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { detectImageMime } from '@/lib/image-sniff';

export const dynamic = 'force-dynamic';

const PHOTO_W = 520;
const PHOTO_H = 630;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_HOSTS = [
  'utfs.io',
  'storage.googleapis.com',
  'firebasestorage.googleapis.com',
  'images.unsplash.com',
  'lh3.googleusercontent.com',
] as const;

function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return (
      ALLOWED_IMAGE_HOSTS.includes(host as (typeof ALLOWED_IMAGE_HOSTS)[number]) ||
      host.endsWith('.uploadthing.com')
    );
  } catch {
    return false;
  }
}

/**
 * Fetches the listing photo and returns it as a data URI satori can render,
 * or null (caller falls back to the branded panel). Never throws — a broken
 * photo must never 500 the card.
 */
async function loadCardImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_IMAGE_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null;
    const mime = detectImageMime(buf);
    if (!mime) return null;

    try {
      // sharp ships with Next (optional dep) — normalize to a cover-cropped
      // JPEG: fixes WebP (unsupported by satori), applies EXIF rotation from
      // phone photos, and shrinks the embedded payload.
      const sharp = (await import('sharp')).default;
      const jpeg = await sharp(buf)
        .rotate()
        .resize(PHOTO_W, PHOTO_H, { fit: 'cover' })
        .jpeg({ quality: 78 })
        .toBuffer();
      return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
    } catch {
      if (mime === 'image/webp') return null; // satori can't decode webp
      return `data:${mime};base64,${buf.toString('base64')}`;
    }
  } catch {
    return null;
  }
}

function formatBDT(n: number): string {
  // Bangladeshi grouping (lakh/crore): 1234567 → 12,34,567.
  // "Tk" instead of "৳": the bundled Bengali woff subset lacks U+09F3, which
  // rendered as tofu in the card (verified visually) — Tk is universally read.
  const s = Math.round(n).toString();
  if (s.length <= 3) return `Tk ${s}`;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `Tk ${rest},${last3}`;
}

function timeLeft(end: Date): string {
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `Ends in ${days}d ${hours}h`;
  if (hours > 0) return `Ends in ${hours}h ${mins % 60}m`;
  return `Ends in ${mins}m`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ auctionId: string }> },
) {
  const { auctionId } = await params;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(auctionId)) {
    return NextResponse.json({ error: 'Invalid auction id' }, { status: 400 });
  }

  const snap = await db.collection('auctions').doc(auctionId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  }
  const a = snap.data()!;

  const title: string = String(a.title ?? 'Auction');
  const price: number = Number(a.currentPrice ?? a.startingPrice ?? 0);
  const bidCount: number = Number(a.bidCount ?? 0);
  const status: string = String(a.status ?? 'ACTIVE');
  const rawEnd = a.endTime as { toDate?: () => Date } | Date | undefined;
  const endTime: Date =
    rawEnd instanceof Date ? rawEnd : rawEnd?.toDate?.() ?? new Date();
  const rawImage: string | null =
    Array.isArray(a.images) && typeof a.images[0] === 'string' && isAllowedImageUrl(a.images[0])
      ? a.images[0]
      : null;
  const image = await loadCardImage(rawImage);

  // Three card states — the old two-state version showed "LIVE AUCTION" +
  // "Bid now" on auctions that had already ended (status still ACTIVE but
  // endTime past), which reads as a scam to anyone who clicks through.
  const isSold = status === 'SOLD' || status === 'AWAITING_PAYMENT';
  const isLive = !isSold && status === 'ACTIVE' && endTime.getTime() > Date.now();

  const badge = isSold ? 'SOLD' : isLive ? 'LIVE AUCTION' : 'AUCTION ENDED';
  const accent = isSold ? '#10b981' : isLive ? '#4f7df9' : '#64748b';
  const priceLabel = isSold
    ? 'SOLD FOR'
    : isLive
      ? bidCount > 0 ? 'CURRENT BID' : 'STARTING PRICE'
      : bidCount > 0 ? 'FINAL BID' : 'LISTED AT';
  const bids = `${bidCount} bid${bidCount === 1 ? '' : 's'}`;
  const statusLine = isSold
    ? `${bids} · Auction complete`
    : isLive
      ? `${bids} · ${timeLeft(endTime)}`
      : `${bids} · Ended`;
  const cta = isSold
    ? 'Sell yours — free on nilamit.com'
    : isLive
      ? 'Bid now → nilamit.com'
      : 'More live auctions → nilamit.com';
  const ctaBg = isSold ? '#059669' : isLive ? '#f59e0b' : '#2c4670';
  const ctaColor = isLive ? '#0b2240' : 'white';

  // Bengali-capable font for ৳ and Bengali titles (same asset /api/og uses).
  let fontData: ArrayBuffer | null = null;
  try {
    const fontRes = await fetch(new URL('../../../../../public/fonts/NotoSansBengali-Bold.woff', import.meta.url));
    if (fontRes.ok) fontData = await fontRes.arrayBuffer();
  } catch {
    /* system fallback below */
  }

  const card = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #0a1e3c 0%, #0e2a52 100%)',
          fontFamily: fontData ? 'NotoBengali' : 'sans-serif',
        }}
      >
        {/* Photo panel */}
        <div style={{ display: 'flex', width: PHOTO_W, height: '100%', position: 'relative', background: '#11294e' }}>
          {image ? (
            <div style={{ display: 'flex', width: PHOTO_W, height: PHOTO_H, position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" width={PHOTO_W} height={PHOTO_H} style={{ objectFit: 'cover', width: PHOTO_W, height: PHOTO_H }} />
              {/* blend the photo's right edge into the card */}
              <div style={{ display: 'flex', position: 'absolute', top: 0, right: 0, width: 120, height: PHOTO_H, background: 'linear-gradient(90deg, rgba(10,30,60,0) 0%, rgba(10,30,60,0.55) 100%)' }} />
            </div>
          ) : (
            // Branded fallback — the old 🔨 emoji rendered as nothing (satori
            // has no emoji font), leaving a big blank panel.
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: PHOTO_W, height: PHOTO_H, background: 'linear-gradient(160deg, #12294d 0%, #0d1f3d 100%)' }}>
              <svg width="180" height="180" viewBox="0 0 24 24" fill="none" stroke="#3d5f9e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8" />
                <path d="m16 16 6-6" />
                <path d="m8 8 6-6" />
                <path d="m9 7 8 8" />
                <path d="m21 11-8-8" />
              </svg>
              <div style={{ display: 'flex', marginTop: 28, fontSize: 34, fontWeight: 700, color: '#5f7db3' }}>
                nilam<span style={{ color: '#7fa3ef' }}>it</span>
              </div>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: '48px 56px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 40, fontWeight: 700, color: 'white' }}>
              nilam<span style={{ color: '#6490f8' }}>it</span>
              <div style={{ display: 'flex', marginLeft: 16, padding: '4px 14px', borderRadius: 999, background: accent, color: 'white', fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
                {badge}
              </div>
            </div>
            <div style={{ display: 'flex', marginTop: 34, fontSize: 44, lineHeight: 1.25, fontWeight: 700, color: 'white', maxHeight: 168, overflow: 'hidden' }}>
              {title.length > 70 ? `${title.slice(0, 70)}…` : title}
            </div>
            <div style={{ display: 'flex', marginTop: 20, width: 64, height: 5, borderRadius: 3, background: accent }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 24, letterSpacing: 4, color: '#93b0e8', fontWeight: 700 }}>
              {priceLabel}
            </div>
            <div style={{ display: 'flex', fontSize: 88, fontWeight: 700, color: 'white', marginTop: 4 }}>
              {formatBDT(price)}
            </div>
            <div style={{ display: 'flex', fontSize: 30, color: '#c8d6f0', marginTop: 8 }}>
              {statusLine}
            </div>
            <div style={{ display: 'flex', marginTop: 28, alignSelf: 'flex-start', padding: '14px 32px', borderRadius: 12, background: ctaBg, color: ctaColor, fontSize: 28, fontWeight: 700 }}>
              {cta}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fontData
        ? [{ name: 'NotoBengali', data: fontData, weight: 700 as const, style: 'normal' as const }]
        : undefined,
    },
  );

  // 5-minute shared cache: fresh enough for repost cycles, cheap enough to
  // survive a group post going viral.
  card.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return card;
}
