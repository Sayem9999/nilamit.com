/**
 * POST /api/mobile/bid  — native-app bidding bridge.
 *
 * Auth: `Authorization: Bearer <Firebase ID token>`. The token's uid equals the
 * platform user id (custom token minted by /api/mobile/auth with uid=userId).
 * We verify it with the Admin SDK, then delegate to the SAME placeBidForUser
 * used by the web Server Action — identical rate limiting, privilege tiers, and
 * anti-snipe transaction. No client-side writes (firestore.rules forbid them).
 *
 * Body: { auctionId: string, amount: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { placeBidForUser } from '@/services/bidding/place-bid-core';
import { ErrorType } from '@/lib/errors';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('fastly-client-ip') ??
    req.headers.get('x-apphosting-client-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    '127.0.0.1'
  );
}

function statusFor(type?: ErrorType): number {
  switch (type) {
    case ErrorType.RATE_LIMIT: return 429;
    case ErrorType.UNAUTHORIZED: return 401;
    case ErrorType.FORBIDDEN: return 403;
    case ErrorType.NOT_FOUND: return 404;
    case ErrorType.VALIDATION: return 400;
    case ErrorType.CONFLICT: return 409;
    case ErrorType.INTERNAL: return 500;
    default: return 400;
  }
}

export async function POST(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ success: false, error: { message: 'Missing bearer token' } }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.instance.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid or expired session token.' } }, { status: 401 });
  }

  let body: { auctionId?: unknown; amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const auctionId = typeof body.auctionId === 'string' ? body.auctionId : '';
  const amount = Number(body.amount);
  if (!auctionId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { success: false, error: { message: 'auctionId (string) and a positive numeric amount are required.' } },
      { status: 400 },
    );
  }

  try {
    const result = await placeBidForUser(uid, auctionId, amount, clientIp(req), req.headers.get('user-agent') ?? 'nilamit-mobile');
    return NextResponse.json(result, { status: result.success ? 200 : statusFor(result.error?.type) });
  } catch (error) {
    log.error('[api/mobile/bid] unexpected failure', error, { uid, area: 'bid', severity: 'critical' });
    return NextResponse.json({ success: false, error: { message: 'Unexpected server error.' } }, { status: 500 });
  }
}
