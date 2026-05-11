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
import { log } from '@/lib/logger';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Sync user email, displayName, and phoneNumber to Firebase Authentication user record (best-effort)
    try {
      const phoneToSync = (session.user.phone && session.user.phone.startsWith('+')) ? session.user.phone : undefined;
      const updateData: Record<string, unknown> = {
        email: session.user.email ?? undefined,
        displayName: session.user.name ?? undefined,
      };
      if (phoneToSync) {
        updateData.phoneNumber = phoneToSync;
      }

      await adminAuth.instance.updateUser(session.user.id, updateData);
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'auth/user-not-found') {
        try {
          const phoneToSync = (session.user.phone && session.user.phone.startsWith('+')) ? session.user.phone : undefined;
          await adminAuth.instance.createUser({
            uid: session.user.id,
            email: session.user.email ?? undefined,
            displayName: session.user.name ?? undefined,
            phoneNumber: phoneToSync,
          });
        } catch (createErr) {
          log.warn('[Firebase Token] Failed to create user in Firebase Auth during sync', { error: createErr });
        }
      } else {
        log.warn('[Firebase Token] Failed to update user in Firebase Auth during sync with phone, trying fallback update without phone', { error: err });
        try {
          await adminAuth.instance.updateUser(session.user.id, {
            email: session.user.email ?? undefined,
            displayName: session.user.name ?? undefined,
          });
        } catch (fallbackErr) {
          log.warn('[Firebase Token] Fallback user update failed', { error: fallbackErr });
        }
      }
    }

    const customClaims: Record<string, unknown> = {};
    if ('isAdmin' in session.user && session.user.isAdmin) {
      customClaims.isAdmin = true;
    }

    const token = await adminAuth.createCustomToken(session.user.id, customClaims);
    return NextResponse.json({ token });
  } catch (error) {
    log.error('[Firebase Token] Failed to create custom token', error);
    return NextResponse.json(
      { error: 'Failed to create Firebase token' },
      { status: 500 }
    );
  }
}
