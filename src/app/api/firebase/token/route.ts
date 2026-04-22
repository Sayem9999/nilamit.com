/**
 * GET /api/firebase/token
 *
 * Mints a Firebase custom auth token for the currently signed-in NextAuth user.
 * The client uses this token to call signInWithCustomToken() so it can access
 * private RTDB paths and Storage buckets guarded by security rules.
 *
 * The token embeds the user's isAdmin status as a custom claim so RTDB rules
 * can grant admin-level access if needed.
 */

import { auth } from '@/lib/auth';
import { adminAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const customClaims: Record<string, unknown> = {};
    if ('isAdmin' in session.user && session.user.isAdmin) {
      customClaims.isAdmin = true;
    }

    const token = await adminAuth.createCustomToken(session.user.id, customClaims);
    return NextResponse.json({ token });
  } catch (error) {
    console.error('[Firebase Token] Failed to create custom token:', error);
    return NextResponse.json(
      { error: 'Failed to create Firebase token' },
      { status: 500 }
    );
  }
}
