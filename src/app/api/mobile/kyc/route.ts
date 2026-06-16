/**
 * KYC (native, Bearer Firebase ID token).
 *   GET  /api/mobile/kyc  → { status, rejectReason }  (users doc isn't client-readable)
 *   POST /api/mobile/kyc  { nidFrontUrl, nidBackUrl, selfieUrl?, tradeLicenseUrl? }
 *                          → submit for review (status → PENDING)
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { db } from '@/lib/db';
import { submitKycForUser } from '@/services/kyc/kyc-core';
import { ErrorType } from '@/lib/errors';
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
    const snap = await db.collection('users').doc(uid).get();
    const u = snap.data() || {};
    return NextResponse.json({
      status: (u.kycStatus as string | undefined) ?? 'NONE',
      rejectReason: (u.kycRejectReason as string | null | undefined) ?? null,
    });
  } catch (e) {
    log.error('[api/mobile/kyc] GET failed', e, { uid, area: 'admin', severity: 'warning' });
    return NextResponse.json({ error: 'Failed to load KYC status' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const uid = await uidFrom(req);
  if (!uid) return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid JSON body.' } }, { status: 400 });
  }

  try {
    const result = await submitKycForUser(uid, body);
    const status = result.success ? 200 : result.error?.type === ErrorType.VALIDATION ? 400 : 500;
    return NextResponse.json(result, { status });
  } catch (e) {
    log.error('[api/mobile/kyc] POST failed', e, { uid, area: 'admin', severity: 'warning' });
    return NextResponse.json({ success: false, error: { message: 'Unexpected server error.' } }, { status: 500 });
  }
}
