/**
 * POST /api/upload
 *
 * Stores an uploaded image in Firebase Storage and returns the public URL.
 *
 * Request: multipart/form-data
 *   - file : File   — the image to upload (required)
 *   - type : string — 'auction' | 'chat' (optional, default: 'auction')
 *
 * Response: { url: string }
 *
 * Limits & validation:
 *   - auction images: max 4 MB
 *   - chat attachments: max 2 MB
 *   - actual bytes must match one of: JPEG, PNG, WebP, GIF (magic-byte check —
 *     the client-supplied Content-Type is not trusted)
 */

import { auth } from '@/lib/auth';
import { adminStorage } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { detectImageMime, SUPPORTED_IMAGE_MIMES } from '@/lib/image-sniff';
import { apiLimiter } from '@/lib/ratelimit';

const LIMITS = {
  auction: 4 * 1024 * 1024,  // 4 MB
  chat:    2 * 1024 * 1024,  // 2 MB
} as const;

// Map detected MIME -> canonical extension. Never trust file.name.
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
};

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
  const type: 'auction' | 'chat' = rawType === 'chat' ? 'chat' : 'auction';

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const maxSize = LIMITS[type];
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `File too large. Max ${maxSize / 1024 / 1024} MB for ${type} uploads.` },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 });
  }

  // Read once, validate against actual bytes, then upload the same buffer.
  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedMime = detectImageMime(buffer);
  if (!detectedMime) {
    return NextResponse.json(
      { error: `File contents are not a valid ${SUPPORTED_IMAGE_MIMES.join(', ')} image` },
      { status: 400 },
    );
  }

  try {
    const ext      = MIME_TO_EXT[detectedMime];
    const folder   = type === 'chat' ? 'chat' : 'auctions';
    const filename = `${folder}/${session.user.id}/${uuidv4()}.${ext}`;
    const bucket   = adminStorage.bucket();
    const fileRef  = bucket.file(filename);

    await fileRef.save(buffer, {
      metadata: {
        contentType:  detectedMime,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          uploadedBy: session.user.id,
          // Capture the originally claimed name for forensics, but never use
          // it for anything that touches a filesystem path.
          originalName: typeof file.name === 'string' ? file.name.slice(0, 256) : '',
        },
      },
    });

    // Auction images are public-read at the storage layer (matches storage.rules).
    // Chat uploads are kept behind a signed URL strategy via storage.rules instead
    // of being made world-public.
    if (type === 'auction') {
      await fileRef.makePublic();
    }

    const url = type === 'auction'
      ? `https://storage.googleapis.com/${bucket.name}/${filename}`
      : await fileRef
          .getSignedUrl({ action: 'read', expires: Date.now() + 7 * 24 * 60 * 60 * 1000 })
          .then(([signed]) => signed);

    return NextResponse.json({ url });
  } catch (error) {
    console.error('[Upload] Firebase Storage error:', error);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
