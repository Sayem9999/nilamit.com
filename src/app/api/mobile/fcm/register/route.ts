/**
 * POST /api/mobile/fcm/register — persist a device push token for the native
 * app (Bearer Firebase ID token). Mirrors /api/fcm/register; appends to
 * users/{uid}.fcmTokens[] so the existing pushToUser sender reaches the device.
 * Body: { token: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/lib/firebase-admin';
import { db } from '@/lib/db';
import { FieldValue } from 'firebase-admin/firestore';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const InputSchema = z.object({ token: z.string().min(20).max(500) });

export async function POST(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  const bearer = authz.startsWith('Bearer ') ? authz.slice(7).trim() : '';
  if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.instance.verifyIdToken(bearer)).uid;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired session token.' }, { status: 401 });
  }

  const parsed = InputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

  try {
    await db.collection('users').doc(uid).update({
      fcmTokens: FieldValue.arrayUnion(parsed.data.token),
      fcmTokensUpdatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('[FCM] mobile token persist failed', err, { userId: uid });
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 });
  }
}
