/**
 * upload-core.ts — the single image validation + storage path.
 *
 * Both the web cookie-auth route (/api/upload) and the native Bearer-token route
 * (/api/mobile/upload) call validateAndStoreImage, so magic-byte sniffing and
 * Cloud Vision SafeSearch (CLAUDE.md rule 12) run identically regardless of
 * surface. Server-only.
 */
import 'server-only';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { detectImageMime, SUPPORTED_IMAGE_MIMES } from '@/lib/image-sniff';
import { moderateImage } from '@/lib/image-moderation';
import { log } from '@/lib/logger';

export const UPLOAD_LIMITS = {
  auction: 4 * 1024 * 1024, // 4 MB
  chat: 2 * 1024 * 1024, // 2 MB
  profile: 2 * 1024 * 1024, // 2 MB — avatars + profile banners
} as const;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function sanitizeFilenameForStorage(name: unknown): string {
  if (typeof name !== 'string') return '';
   
  return name.replace(/[\x00-\x1f\x7f<>"'`]/g, '').slice(0, 256);
}

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

export type UploadType = keyof typeof UPLOAD_LIMITS;

export async function validateAndStoreImage(
  userId: string,
  buffer: Buffer,
  type: UploadType,
  originalName: unknown,
): Promise<UploadResult> {
  const maxSize = UPLOAD_LIMITS[type];
  if (buffer.length === 0) return { ok: false, status: 400, error: 'Empty file' };
  if (buffer.length > maxSize) {
    return { ok: false, status: 400, error: `File too large. Max ${maxSize / 1024 / 1024} MB for ${type} uploads.` };
  }

  const detectedMime = detectImageMime(buffer);
  if (!detectedMime) {
    return { ok: false, status: 400, error: `File contents are not a valid ${SUPPORTED_IMAGE_MIMES.join(', ')} image` };
  }

  const moderation = await moderateImage(buffer);
  if (!moderation.allowed) {
    log.warn('[Upload] Rejected by SafeSearch', { userId, reason: moderation.reason, scores: moderation.scores });
    return { ok: false, status: 422, error: 'This image violates our content policy and cannot be uploaded.' };
  }

  try {
    const ext = MIME_TO_EXT[detectedMime];
    // 'profile' gets its own prefix — profile media used to ride the auctions/
    // prefix, where the gc-uploads cron (which only knows about auction docs'
    // images[]) deleted every avatar/banner a week after upload.
    const folder = type === 'chat' ? 'chat' : type === 'profile' ? 'profiles' : 'auctions';
    const filename = `${folder}/${userId}/${uuidv4()}.${ext}`;
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(filename);

    await fileRef.save(buffer, {
      metadata: {
        contentType: detectedMime,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          uploadedBy: userId,
          uploadedFor: type,
          uploadedAtMs: String(Date.now()),
          originalName: sanitizeFilenameForStorage(originalName),
        },
      },
    });

    if (type === 'auction' || type === 'profile') {
      // Public-read prefixes (see storage.rules) — a stable, never-expiring URL.
      return {
        ok: true,
        url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileRef.name)}?alt=media`,
      };
    }
    const expiresMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const [url] = await fileRef.getSignedUrl({ action: 'read', expires: expiresMs });
    return { ok: true, url };
  } catch (error) {
    log.error('[Upload] Firebase Storage error', error, { area: 'upload', severity: 'warning' });
    return { ok: false, status: 500, error: 'Upload failed. Please try again.' };
  }
}
