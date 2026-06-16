/**
 * POST /api/mobile/escrow — post-sale escrow actions (Bearer Firebase ID token).
 * Body: { action: 'confirm' | 'ship' | 'dispute', transactionId, trackingNumber?, reason? }
 * Delegates to the shared escrow cores (same transactions as the web actions).
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { db } from '@/lib/db';
import {
  confirmItemReceivedForUser,
  markAsShippedForUser,
  raiseDisputeForUser,
} from '@/services/escrow/escrow-core';
import { ErrorType, ServiceResponse } from '@/lib/errors';
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

/**
 * GET /api/mobile/escrow?auctionId=...  → escrow status for a buyer/seller.
 * escrowTransactions is not client-readable (firestore.rules catch-all denies),
 * so the app reads status through this auth-gated endpoint.
 */
export async function GET(req: NextRequest) {
  const uid = await uidFrom(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const auctionId = req.nextUrl.searchParams.get('auctionId') || '';
  if (!auctionId) return NextResponse.json({ error: 'auctionId required' }, { status: 400 });

  try {
    const snap = await db.collection('escrowTransactions').doc(auctionId).get();
    if (!snap.exists) return NextResponse.json({ exists: false });
    const t = snap.data()!;
    if (t.buyerId !== uid && t.sellerId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const aSnap = await db.collection('auctions').doc(auctionId).get();
    const deliveryStatus = (aSnap.data()?.deliveryStatus as string | undefined) ?? null;
    const trackingNumber = (aSnap.data()?.trackingNumber as string | undefined) ?? null;
    return NextResponse.json({
      exists: true,
      status: t.status ?? null,
      deliveryStatus,
      trackingNumber,
      amount: t.amount ?? 0,
      role: t.buyerId === uid ? 'buyer' : 'seller',
    });
  } catch (e) {
    log.error('[api/mobile/escrow] GET failed', e, { area: 'escrow', severity: 'warning' });
    return NextResponse.json({ error: 'Failed to load escrow' }, { status: 500 });
  }
}

function statusFor(type?: ErrorType): number {
  switch (type) {
    case ErrorType.UNAUTHORIZED: return 401;
    case ErrorType.FORBIDDEN: return 403;
    case ErrorType.NOT_FOUND: return 404;
    case ErrorType.VALIDATION: return 400;
    case ErrorType.INTERNAL: return 500;
    default: return 400;
  }
}

export async function POST(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : '';
  if (!token) return NextResponse.json({ success: false, error: { message: 'Missing bearer token' } }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.instance.verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid or expired session token.' } }, { status: 401 });
  }

  let body: { action?: unknown; transactionId?: unknown; trackingNumber?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const action = body.action;
  const transactionId = typeof body.transactionId === 'string' ? body.transactionId : '';
  if (!transactionId) {
    return NextResponse.json({ success: false, error: { message: 'transactionId is required.' } }, { status: 400 });
  }

  try {
    let result: ServiceResponse<null>;
    if (action === 'confirm') {
      result = await confirmItemReceivedForUser(uid, transactionId);
    } else if (action === 'ship') {
      result = await markAsShippedForUser(uid, transactionId, typeof body.trackingNumber === 'string' ? body.trackingNumber : '');
    } else if (action === 'dispute') {
      result = await raiseDisputeForUser(uid, transactionId, typeof body.reason === 'string' ? body.reason : '');
    } else {
      return NextResponse.json({ success: false, error: { message: 'Unknown action.' } }, { status: 400 });
    }
    return NextResponse.json(result, { status: result.success ? 200 : statusFor(result.error?.type) });
  } catch (error) {
    log.error('[api/mobile/escrow] unexpected failure', error, { uid, area: 'escrow', severity: 'critical' });
    return NextResponse.json({ success: false, error: { message: 'Unexpected server error.' } }, { status: 500 });
  }
}
