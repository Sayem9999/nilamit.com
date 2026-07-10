/**
 * POST /api/upload  (web, cookie-authenticated)
 *
 * Stores an uploaded image in Firebase Storage and returns the URL. Validation
 * (size, magic-byte sniff, SafeSearch) and storage live in the shared
 * validateAndStoreImage core, also used by /api/mobile/upload.
 *
 * Request: multipart/form-data — file (required), type ('auction' | 'chat').
 * Response: { url: string }
 */
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter } from '@/lib/ratelimit';
import { validateAndStoreImage } from '@/lib/upload-core';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Per-user rate limit. Without this a single account can OOM the storage
  // budget by uploading thousands of files in a tight loop.
  const gate = await apiLimiter.limit(`upload_${session.user.id}`);
  if (!gate.success) {
    return NextResponse.json({ error: 'Too many uploads. Please slow down.' }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const rawType = formData.get('type');
  const type: 'auction' | 'chat' | 'profile' =
    rawType === 'chat' ? 'chat' : rawType === 'profile' ? 'profile' : 'auction';

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await validateAndStoreImage(session.user.id, buffer, type, file.name);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url });
}
