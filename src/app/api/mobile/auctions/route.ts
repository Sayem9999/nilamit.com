/**
 * POST /api/mobile/auctions — create a listing from the native app
 * (Bearer Firebase ID token). Delegates to createAuctionForUser (same gates as
 * the web create-auction action). Body: CreateAuctionInput (see createAuctionSchema).
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { createAuctionForUser } from '@/services/auction/create-core';
import { ErrorType } from '@/lib/errors';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function statusFor(type?: ErrorType): number {
  switch (type) {
    case ErrorType.UNAUTHORIZED: return 401;
    case ErrorType.FORBIDDEN: return 403;
    case ErrorType.VALIDATION: return 400;
    case ErrorType.RATE_LIMIT: return 429;
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid JSON body.' } }, { status: 400 });
  }

  try {
    const result = await createAuctionForUser(uid, body);
    return NextResponse.json(result, { status: result.success ? 200 : statusFor(result.error?.type) });
  } catch (error) {
    log.error('[api/mobile/auctions] unexpected failure', error, { uid, area: 'admin', severity: 'warning' });
    return NextResponse.json({ success: false, error: { message: 'Unexpected server error.' } }, { status: 500 });
  }
}
