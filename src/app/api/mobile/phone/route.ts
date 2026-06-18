/**
 * POST /api/mobile/phone — bind an SMS-verified phone number to the signed-in
 * native user.
 *
 * Two-token design:
 *   - Authorization: Bearer <Firebase ID token of the platform user>  → identity (uid)
 *   - body.phoneIdToken: a Firebase ID token carrying a phone_number claim,
 *     minted by Firebase Phone Auth on-device (@react-native-firebase/auth)  → phone proof
 *
 * Both are verified by the Admin SDK against our project. The phone token proves
 * SMS control; the Authorization token says which account to attach it to.
 * Delegates the uniqueness check + write to setVerifiedPhoneForUser (shared with
 * the web confirmPhoneVerification action).
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { mfsOtpVerifyLimiter } from '@/lib/ratelimit';
import { setVerifiedPhoneForUser } from '@/services/phone/phone-core';
import { ErrorType } from '@/lib/errors';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function statusFor(type?: ErrorType): number {
  switch (type) {
    case ErrorType.CONFLICT: return 409;
    case ErrorType.VALIDATION: return 400;
    case ErrorType.UNAUTHORIZED: return 401;
    default: return 500;
  }
}

export async function POST(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : '';
  if (!token) return NextResponse.json({ success: false, error: { message: 'Missing bearer token' } }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.instance.verifyIdToken(token, true /* checkRevoked */)).uid;
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid or expired session token.' } }, { status: 401 });
  }

  const gate = await mfsOtpVerifyLimiter.limit(`phone_confirm_${uid}`);
  if (!gate.success) {
    return NextResponse.json({ success: false, error: { message: 'Too many attempts. Please wait 15 minutes.' } }, { status: 429 });
  }

  let phoneIdToken = '';
  try {
    const body = (await req.json()) as { phoneIdToken?: unknown };
    phoneIdToken = typeof body.phoneIdToken === 'string' ? body.phoneIdToken : '';
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid JSON body.' } }, { status: 400 });
  }
  if (phoneIdToken.length < 100 || phoneIdToken.length > 4096) {
    return NextResponse.json({ success: false, error: { message: 'Invalid phone verification token.' } }, { status: 400 });
  }

  try {
    const phoneDecoded = await adminAuth.instance.verifyIdToken(phoneIdToken);
    const rawPhone = phoneDecoded.phone_number;
    if (!rawPhone) {
      return NextResponse.json({ success: false, error: { message: 'That token has no verified phone number.' } }, { status: 400 });
    }

    const result = await setVerifiedPhoneForUser(uid, rawPhone);
    return NextResponse.json(result, { status: result.success ? 200 : statusFor(result.error?.type) });
  } catch (e) {
    log.error('[api/mobile/phone] failed', e, { uid, area: 'auth', severity: 'warning' });
    return NextResponse.json({ success: false, error: { message: 'Phone verification failed.' } }, { status: 500 });
  }
}
