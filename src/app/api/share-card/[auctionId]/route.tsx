/**
 * GET /api/share-card/{auctionId}
 *
 * Live auction share card — a 1200×630 PNG with the CURRENT bid, bid count,
 * and time remaining, branded for posting into Facebook groups / WhatsApp
 * (the GROWTH.md distribution playbook). Unlike /api/og (static params baked
 * at metadata time), this reads the auction live so a reposted card always
 * shows the real price.
 *
 * Status-aware: ACTIVE renders "CURRENT BID + ends in…"; SOLD renders the
 * result card ("SOLD ৳X · N bids") — the post-sale trust artifact the
 * playbook says to share after every successful auction.
 *
 * Node runtime (not edge) on purpose: needs the Admin SDK for the live read.
 * Public data only (title/price/count/end-time/photo). Cached 5 minutes.
 */

import { ImageResponse } from 'next/og';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_HOSTS = [
  'utfs.io',
  'storage.googleapis.com',
  'firebasestorage.googleapis.com',
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
  const image: string | null =
    Array.isArray(a.images) && typeof a.images[0] === 'string' && isAllowedImageUrl(a.images[0])
      ? a.images[0]
      : null;

  const isSold = status === 'SOLD';
  const statusLine = isSold
    ? `SOLD · ${bidCount} bid${bidCount === 1 ? '' : 's'}`
    : `${bidCount} bid${bidCount === 1 ? '' : 's'} · ${timeLeft(endTime)}`;
  const priceLabel = isSold ? 'FINAL PRICE' : 'CURRENT BID';
  const accent = isSold ? '#059669' : '#3665f3';

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
          background: '#0b2240',
          fontFamily: fontData ? 'NotoBengali' : 'sans-serif',
        }}
      >
        {/* Photo panel */}
        <div style={{ display: 'flex', width: 520, height: '100%', position: 'relative', background: '#13294b' }}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" width={520} height={630} style={{ objectFit: 'cover', width: 520, height: 630 }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 520, height: 630, fontSize: 160 }}>
              🔨
            </div>
          )}
        </div>

        {/* Info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: '48px 56px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 40, fontWeight: 700, color: 'white' }}>
              nilam<span style={{ color: '#6490f8' }}>it</span>
              <div style={{ display: 'flex', marginLeft: 16, padding: '4px 14px', borderRadius: 999, background: accent, color: 'white', fontSize: 20, fontWeight: 700 }}>
                {isSold ? 'SOLD' : 'LIVE AUCTION'}
              </div>
            </div>
            <div style={{ display: 'flex', marginTop: 36, fontSize: 44, lineHeight: 1.25, fontWeight: 700, color: 'white', maxHeight: 168, overflow: 'hidden' }}>
              {title.length > 70 ? `${title.slice(0, 70)}…` : title}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 24, letterSpacing: 4, color: '#9ab8f5', fontWeight: 700 }}>
              {priceLabel}
            </div>
            <div style={{ display: 'flex', fontSize: 88, fontWeight: 700, color: 'white', marginTop: 4 }}>
              {formatBDT(price)}
            </div>
            <div style={{ display: 'flex', fontSize: 30, color: '#c8d6f0', marginTop: 8 }}>
              {statusLine}
            </div>
            <div style={{ display: 'flex', marginTop: 28, alignSelf: 'flex-start', padding: '14px 32px', borderRadius: 12, background: isSold ? '#059669' : '#f59e0b', color: isSold ? 'white' : '#0b2240', fontSize: 28, fontWeight: 700 }}>
              {isSold ? 'Sell yours — free on nilamit.com' : 'Bid now → nilamit.com'}
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
