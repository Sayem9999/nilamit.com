/**
 * Watchlist (native, Bearer Firebase ID token).
 *   POST /api/mobile/watchlist  { auctionId }  → toggle, returns { watching }
 *   GET  /api/mobile/watchlist                 → { auctionIds: string[] }
 *
 * Mirrors src/actions/watchlist.ts storage (collection `watchlist`, doc id
 * `${userId}_${auctionId}`). Writes are server-only per firestore.rules.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function uidFrom(req: NextRequest): Promise<string | null> {
  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : '';
  if (!token) return null;
  try {
    return (await adminAuth.instance.verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const uid = await uidFrom(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const snap = await db.collection('watchlist').where('userId', '==', uid).get();
    const auctionIds = snap.docs.map((d) => d.data().auctionId as string).filter(Boolean);
    return NextResponse.json({ auctionIds });
  } catch (e) {
    log.error('[api/mobile/watchlist] GET failed', e);
    return NextResponse.json({ error: 'Failed to load watchlist' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const uid = await uidFrom(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let auctionId = '';
  try {
    const body = (await req.json()) as { auctionId?: unknown };
    auctionId = typeof body.auctionId === 'string' ? body.auctionId : '';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!auctionId) return NextResponse.json({ error: 'auctionId required' }, { status: 400 });

  try {
    const ref = db.collection('watchlist').doc(`${uid}_${auctionId}`);
    const snap = await ref.get();
    if (snap.exists) {
      await ref.delete();
      return NextResponse.json({ watching: false });
    }
    await ref.set({ id: `${uid}_${auctionId}`, userId: uid, auctionId, createdAt: new Date() });
    return NextResponse.json({ watching: true });
  } catch (e) {
    log.error('[api/mobile/watchlist] POST failed', e);
    return NextResponse.json({ error: 'Failed to update watchlist' }, { status: 500 });
  }
}
