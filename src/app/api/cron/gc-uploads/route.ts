/**
 * POST /api/cron/gc-uploads
 *
 * Garbage-collects Storage objects under auctions/ that are not referenced by
 * any auction document AND are older than the soft-grace window. Without this
 * job, every aborted listing flow leaves an orphaned image bloating Storage.
 *
 * Conservative defaults — only files older than 7 days, max 500 deletes per
 * run. Scheduled weekly.
 */

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { adminStorage } from '@/lib/firebase-admin';
import { verifyCronSecret, withRetry, cronError } from '@/lib/cron-utils';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const GRACE_MS         = 7 * 24 * 60 * 60 * 1000;
const MAX_DELETES      = 500;
const PAGE_SIZE        = 1000;
const STORAGE_PREFIX   = 'auctions/';

// Quick test for whether a URL string references the given file path.
// Signed URLs include the encoded object name; we just substring-check.
function urlReferencesPath(url: string, encodedPath: string): boolean {
  return typeof url === 'string' && url.includes(encodedPath);
}

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const result = await withRetry(async () => {
    const bucket = adminStorage.bucket();
    const cutoff = Date.now() - GRACE_MS;

    // 1. Build the set of referenced paths from all auction docs.
    //    Auctions store image URLs in `images: string[]`. We extract the encoded
    //    object path from each URL so we can match against listFiles entries.
    const auctionsSnap = await db.collection('auctions').select('images').get();
    const referenced   = new Set<string>();
    for (const doc of auctionsSnap.docs) {
      const images = (doc.data().images ?? []) as unknown[];
      if (!Array.isArray(images)) continue;
      for (const url of images) {
        if (typeof url !== 'string') continue;
        // Try to extract `auctions/...` substring from the URL path.
        const idx = url.indexOf(STORAGE_PREFIX);
        if (idx >= 0) {
          // Stop at the first `?` (query string) to get just the object name.
          const tail  = url.slice(idx);
          const clean = tail.split('?')[0];
          referenced.add(decodeURIComponent(clean));
        }
      }
    }

    // 2. Walk Storage in pages, delete orphans up to MAX_DELETES.
    let deleted = 0;
    let scanned = 0;
    let pageToken: string | undefined;

    do {
      const result = await bucket.getFiles({
        prefix:       STORAGE_PREFIX,
        maxResults:   PAGE_SIZE,
        pageToken,
        autoPaginate: false,
      });
      const files     = result[0];
      const nextQuery = result[1] as { pageToken?: string } | null | undefined;

      for (const file of files) {
        if (deleted >= MAX_DELETES) break;
        scanned++;

        const path = file.name;
        if (referenced.has(path)) continue;

        // Some clients store URLs with the path partially encoded — also test
        // an encoded form against the URL set.
        const encoded = encodeURIComponent(path).replace(/%2F/g, '/');
        if ([...referenced].some(r => urlReferencesPath(r, encoded))) continue;

        // Age guard.
        const [meta] = await file.getMetadata();
        const updatedAt = meta.updated ? new Date(meta.updated as string).getTime() : 0;
        if (updatedAt > cutoff) continue;

        try {
          await file.delete({ ignoreNotFound: true });
          deleted++;
        } catch (e) {
          log.error('[Cron:gc-uploads] delete failed', e, { path });
        }
      }

      pageToken = nextQuery?.pageToken;
    } while (pageToken && deleted < MAX_DELETES);

    return { scanned, deleted, referenced: referenced.size };
  }, { maxAttempts: 2, initialDelayMs: 5000 });

  if (result.error) {
    Sentry.captureException(result.error, {
      tags: { component: 'cron', job: 'gc-uploads' },
    });
    return cronError(`gc-uploads failed: ${result.error.message}`);
  }

  return NextResponse.json({
    success: true,
    ...result.data,
    processedAt: new Date().toISOString(),
  });
}
