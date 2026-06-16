/**
 * POST /api/mobile/auth  — native-app Google sign-in bridge.
 *
 * The web uses Auth.js (NextAuth) for identity; the native app can't ride the
 * NextAuth cookie flow. Instead the app signs in with Google, sends the Google
 * ID token here, and we:
 *   1. Verify the Google ID token (signature + audience allowlist + email_verified).
 *   2. Find the matching platform user by email, or provision one mirroring the
 *      NextAuth FirestoreAdapter.createUser shape (Google emails are verified, so
 *      emailVerified is set — enabling bidding).
 *   3. Sync the Firebase Auth record (uid = platform user id) like /api/firebase/token.
 *   4. Mint a Firebase custom token (uid = platform user id) the app exchanges via
 *      signInWithCustomToken — so its ID token's uid maps straight to users/{uid}.
 *
 * Body: { idToken: string }   →   { success, firebaseToken, user }
 *
 * SETUP: set the GOOGLE_MOBILE_CLIENT_IDS secret (comma-separated Android/iOS/web
 * OAuth client IDs the app uses) so their audience is accepted. GOOGLE_CLIENT_ID
 * (web) is always allowed. See mobile/docs/PARITY.md.
 */
import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { adminAuth } from '@/lib/firebase-admin';
import { db } from '@/lib/db';
import { authLimiter } from '@/lib/ratelimit';
import { isAdminEmail } from '@/lib/admin-guard';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AUDIENCES = [
  process.env.GOOGLE_CLIENT_ID,
  ...(process.env.GOOGLE_MOBILE_CLIENT_IDS || '').split(',').map((s) => s.trim()),
].filter(Boolean) as string[];

const googleClient = new OAuth2Client();

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('fastly-client-ip') ??
    req.headers.get('x-apphosting-client-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    '127.0.0.1'
  );
}

export async function POST(req: NextRequest) {
  const { success: rateOk } = await authLimiter.limit(`mobile_auth_${clientIp(req)}`);
  if (!rateOk) {
    return NextResponse.json({ success: false, error: { message: 'Too many attempts. Try again shortly.' } }, { status: 429 });
  }

  let idToken = '';
  try {
    const body = (await req.json()) as { idToken?: unknown };
    idToken = typeof body.idToken === 'string' ? body.idToken : '';
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid JSON body.' } }, { status: 400 });
  }
  if (!idToken) {
    return NextResponse.json({ success: false, error: { message: 'idToken is required.' } }, { status: 400 });
  }

  // 1. Verify Google ID token.
  let payload: import('google-auth-library').TokenPayload | undefined;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: AUDIENCES.length ? AUDIENCES : undefined,
    });
    payload = ticket.getPayload();
  } catch (e) {
    log.warn('[api/mobile/auth] Google token verification failed', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ success: false, error: { message: 'Invalid Google token.' } }, { status: 401 });
  }

  if (!payload?.email || payload.email_verified !== true) {
    return NextResponse.json({ success: false, error: { message: 'A verified Google email is required.' } }, { status: 403 });
  }
  if (AUDIENCES.length && payload.aud && !AUDIENCES.includes(payload.aud)) {
    return NextResponse.json({ success: false, error: { message: 'Token audience not allowed.' } }, { status: 401 });
  }

  const email = payload.email.toLowerCase();
  const name = payload.name ?? null;
  const image = payload.picture ?? null;

  try {
    // 2. Find or provision the platform user.
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    let userId: string;
    let userData: Record<string, unknown>;

    if (!snap.empty) {
      userId = snap.docs[0].id;
      userData = snap.docs[0].data();
      // Backfill emailVerified for Google-verified users so bidding works.
      if (userData.emailVerified == null) {
        const now = new Date();
        await db.collection('users').doc(userId).update({ emailVerified: now, updatedAt: now });
        userData.emailVerified = now;
      }
    } else {
      const ref = db.collection('users').doc();
      const now = new Date();
      userData = {
        id: ref.id,
        email,
        name,
        image,
        emailVerified: now, // Google verifies email
        createdAt: now,
        updatedAt: now,
        isVerifiedSeller: false,
        reputationScore: 0,
        winningStreak: 0,
        xp: 0,
        userLevel: 1,
        ...(name ? { nameLowercase: name.toLowerCase() } : {}),
      };
      await ref.set(userData);
      userId = ref.id;
      // Link the Google account for web parity (best-effort).
      try {
        const acctRef = db.collection('accounts').doc();
        await acctRef.set({
          id: acctRef.id,
          userId,
          provider: 'google',
          providerAccountId: payload.sub,
          type: 'oidc',
        });
      } catch (e) {
        log.warn('[api/mobile/auth] account link failed', { error: e });
      }
    }

    // 3. Sync the Firebase Auth record (uid = platform user id).
    try {
      await adminAuth.instance.updateUser(userId, { email, displayName: name ?? undefined });
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'auth/user-not-found') {
        try {
          await adminAuth.instance.createUser({ uid: userId, email, displayName: name ?? undefined });
        } catch (createErr) {
          log.warn('[api/mobile/auth] Firebase Auth createUser failed', { error: createErr });
        }
      } else {
        log.warn('[api/mobile/auth] Firebase Auth updateUser failed', { error: e });
      }
    }

    // 4. Mint the custom token.
    const claims: Record<string, unknown> = {};
    const admin = isAdminEmail(email);
    if (admin) claims.isAdmin = true;
    if (userData.isVerifiedSeller) claims.isVerifiedSeller = true;

    const firebaseToken = await adminAuth.createCustomToken(userId, claims);

    return NextResponse.json({
      success: true,
      firebaseToken,
      user: {
        id: userId,
        email,
        name: (userData.name as string | null) ?? name,
        image: (userData.image as string | null) ?? image,
        emailVerified: true,
        isAdmin: admin,
      },
    });
  } catch (error) {
    log.error('[api/mobile/auth] bridge failure', error, { area: 'auth', severity: 'critical' });
    return NextResponse.json({ success: false, error: { message: 'Sign-in failed. Please try again.' } }, { status: 500 });
  }
}
