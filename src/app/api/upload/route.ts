/**
 * POST /api/upload
 *
 * Replaces UploadThing. Accepts a multipart form upload, stores the file in
 * Firebase Storage, and returns the public download URL.
 *
 * Request: multipart/form-data
 *   - file      : File     — the image to upload (required)
 *   - type      : string   — 'auction' | 'chat' (optional, default: 'auction')
 *
 * Response: { url: string }
 *
 * Limits:
 *   - auction images: max 4 MB, images only
 *   - chat attachments: max 2 MB, images only
 */

import { auth } from '@/lib/auth';
import { adminStorage } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

const LIMITS = {
  auction: 4 * 1024 * 1024,  // 4 MB
  chat:    2 * 1024 * 1024,  // 2 MB
} as const;

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const type = (formData.get('type') as string) ?? 'auction';

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, WebP, and GIF images are allowed' },
      { status: 400 }
    );
  }

  const maxSize = type === 'chat' ? LIMITS.chat : LIMITS.auction;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `File too large. Max ${maxSize / 1024 / 1024} MB for ${type} uploads.` },
      { status: 400 }
    );
  }

  try {
    const ext        = file.name.split('.').pop() ?? 'jpg';
    const folder     = type === 'chat' ? 'chat' : 'auctions';
    const filename   = `${folder}/${session.user.id}/${uuidv4()}.${ext}`;
    const buffer     = Buffer.from(await file.arrayBuffer());
    const bucket     = adminStorage.bucket();
    const fileRef    = bucket.file(filename);

    await fileRef.save(buffer, {
      metadata: {
        contentType:  file.type,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          uploadedBy: session.user.id,
          originalName: file.name,
        },
      },
    });

    // Make the file publicly readable
    await fileRef.makePublic();

    const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    return NextResponse.json({ url });
  } catch (error) {
    console.error('[Upload] Firebase Storage error:', error);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
