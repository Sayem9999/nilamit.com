/**
 * POST /api/mobile/escrow — post-sale escrow actions (Bearer Firebase ID token).
 * Body: { action: 'confirm' | 'ship' | 'dispute', transactionId, trackingNumber?, reason? }
 * Delegates to the shared escrow cores (same transactions as the web actions).
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import {
  confirmItemReceivedForUser,
  markAsShippedForUser,
  raiseDisputeForUser,
} from '@/services/escrow/escrow-core';
import { ErrorType, ServiceResponse } from '@/lib/errors';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
