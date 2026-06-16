/**
 * POST /api/mobile/upload — native image upload (Bearer Firebase ID token).
 * Same validation/storage as /api/upload via validateAndStoreImage.
 * Request: multipart/form-data — file (required). Response: { url }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { apiLimiter } from '@/lib/ratelimit';
import { validateAndStoreImage } from '@/lib/upload-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.instance.verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired session token.' }, { status: 401 });
  }

  const gate = await apiLimiter.limit(`upload_${uid}`);
  if (!gate.success) return NextResponse.json({ error: 'Too many uploads. Please slow down.' }, { status: 429 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await validateAndStoreImage(uid, buffer, 'auction', file.name);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url });
}
