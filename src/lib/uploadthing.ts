/**
 * uploadthing.ts — Firebase Storage upload helpers
 *
 * Replaces the old @uploadthing/react generated components.
 * Used in components that need to upload auction images or chat attachments.
 *
 * For server-side uploads (API route), see src/app/api/upload/route.ts.
 * For direct client-side uploads (chat), see ChatInterface.tsx which uses
 * firebase/storage uploadBytes() directly.
 */

export type UploadType = 'auction' | 'chat' | 'nid';

/**
 * Upload a file to Firebase Storage via the /api/upload server route.
 * For public types ('auction', 'chat') returns the public URL.
 * For private 'nid' uploads returns the storage path (used later to mint
 * short-lived signed URLs for the owner and admins).
 *
 * @param file  - The File object to upload
 * @param type  - 'auction' (max 4 MB) | 'chat' (max 2 MB) | 'nid' (max 3 MB, private)
 */
export async function uploadFile(file: File, type: UploadType = 'auction'): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);

  const res = await fetch('/api/upload', { method: 'POST', body: form });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Upload failed');
  }

  const payload = await res.json() as { url?: string; path?: string };
  // For 'nid' the server returns { path }; for public types it returns { url }.
  const result = payload.url ?? payload.path;
  if (!result) throw new Error('Upload succeeded but response was empty.');
  return result;
}

/**
 * Upload multiple auction images.
 * Returns an array of public URLs.
 */
export async function uploadAuctionImages(files: File[]): Promise<string[]> {
  return Promise.all(files.map(f => uploadFile(f, 'auction')));
}
