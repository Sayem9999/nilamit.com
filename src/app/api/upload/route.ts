/**
 * POST /api/upload
 *
 * Replaces UploadThing. Accepts a multipart form upload, stores the file in
 * Firebase Storage, and returns the public download URL — unless the upload
 * type is `nid`, in which case the file goes to a private path and the
 * response returns the storage path (signed URLs are minted on demand by
 * admin review actions).
 *
 * Request: multipart/form-data
 *   - file      : File     — the image to upload (required)
 *   - type      : string   — 'auction' | 'chat' | 'nid' (optional, default: 'auction')
 *
 * Response:
 *   - for public types: { url: string }
 *   - for 'nid':        { path: string }   // private — signed URL fetched later
 *
 * Limits:
 *   - auction images: max 4 MB, images only
 *   - chat attachments: max 2 MB, images only
 *   - nid images: max 3 MB, images only, private
 */

import { auth } from '@/lib/auth';
import { adminStorage } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

const LIMITS = {
  auction: 4 * 1024 * 1024,  // 4 MB
  chat:    2 * 1024 * 1024,  // 2 MB
  nid:     3 * 1024 * 1024,  // 3 MB
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

  const maxSize =
    type === 'chat' ? LIMITS.chat :
    type === 'nid'  ? LIMITS.nid  :
    LIMITS.auction;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `File too large. Max ${maxSize / 1024 / 1024} MB for ${type} uploads.` },
      { status: 400 }
    );
  }

  try {
    const ext        = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') ?? 'jpg';
    const folder     =
      type === 'chat' ? 'chat' :
      type === 'nid'  ? 'nid'  :
      'auctions';
    const filename   = `${folder}/${session.user.id}/${uuidv4()}.${ext}`;
    const buffer     = Buffer.from(await file.arrayBuffer());
    const bucket     = adminStorage.bucket();
    const fileRef    = bucket.file(filename);

    await fileRef.save(buffer, {
      metadata: {
        contentType:  file.type,
        // NID images must NOT be cached on public CDNs
        cacheControl: type === 'nid'
          ? 'private, no-store'
          : 'public, max-age=31536000, immutable',
        metadata: {
          uploadedBy:  session.user.id,
          originalName: file.name,
          sensitivity: type === 'nid' ? 'restricted' : 'public',
        },
      },
    });

    if (type === 'nid') {
      // Private: return the storage path only. Signed URLs are minted later.
      return NextResponse.json({ path: filename });
    }

    // Public types: make the file publicly readable and return the URL.
    await fileRef.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    return NextResponse.json({ url });
  } catch (error) {
    console.error('[Upload] Firebase Storage error:', error);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
