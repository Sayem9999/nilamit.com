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

/**
 * Upload a file to Firebase Storage via the /api/upload server route.
 * Returns the public URL on success, throws on error.
 *
 * @param file  - The File object to upload
 * @param type  - 'auction' (max 4 MB) | 'chat' (max 2 MB)
 */
export async function uploadFile(file: File, type: 'auction' | 'chat' = 'auction'): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);

  const res = await fetch('/api/upload', { method: 'POST', body: form });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Upload failed');
  }

  const { url } = await res.json() as { url: string };
  return url;
}

/**
 * Upload multiple auction images.
 * Returns an array of public URLs.
 */
export async function uploadAuctionImages(files: File[]): Promise<string[]> {
  return Promise.all(files.map(f => uploadFile(f, 'auction')));
}
