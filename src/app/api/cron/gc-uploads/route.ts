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

// Strip a Resize-Images extension size suffix (`_200x200`) so a thumbnail maps
// back to its base original: `auctions/uid/uuid_200x200.webp` -> `.../uuid.webp`.
function baseObjectPath(path: string): string {
  return path.replace(/_\d+x\d+(\.[^./]+)$/, '$1');
}

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const result = await withRetry(async () => {
    const bucket = adminStorage.bucket();
    const cutoff = Date.now() - GRACE_MS;

    // 1. Build the set of referenced paths from all auction docs AND all user
    //    profile media. Profile avatars/banners historically uploaded to the
    //    auctions/ prefix (before the dedicated profiles/ prefix existed), so
    //    users.image + users.banner MUST count as references — the GC used to
    //    delete every custom avatar/banner a week after upload because it only
    //    consulted auction docs.
    const [auctionsSnap, usersSnap] = await Promise.all([
      db.collection('auctions').select('images').get(),
      db.collection('users').select('image', 'banner').get(),
    ]);
    const referenced = new Set<string>();
    const referencedUrls: unknown[] = [];
    for (const doc of auctionsSnap.docs) {
      const images = (doc.data().images ?? []) as unknown[];
      if (Array.isArray(images)) referencedUrls.push(...images);
    }
    for (const doc of usersSnap.docs) {
      const d = doc.data() as { image?: unknown; banner?: unknown };
      referencedUrls.push(d.image, d.banner);
    }
    for (const url of referencedUrls) {
      if (typeof url !== 'string') continue;
      // Auction URLs encode the object path with slashes as `%2F` (firebase
      // download URLs: `.../o/auctions%2Fuid%2Fuuid.webp?alt=media`) — legacy
      // signed URLs kept them literal. Decode first so BOTH forms expose a
      // literal `auctions/...` path. Without this, indexOf returns -1 for every
      // modern URL, the referenced set is empty, and the GC below deletes every
      // in-use auction image once it ages past the grace window.
      let decoded: string;
      try {
        decoded = decodeURIComponent(url);
      } catch {
        // Malformed percent-encoding in one stored URL must not abort the
        // whole run — treat the raw string as the reference instead.
        decoded = url;
      }
      const idx = decoded.indexOf(STORAGE_PREFIX);
      if (idx < 0) continue;
      // Stop at the first `?` (query string) to get just the object name.
      const clean = decoded.slice(idx).split('?')[0];
      referenced.add(clean);
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

        // The Resize-Images extension writes sibling thumbnails (`_200x200`)
        // that are NEVER stored in the doc's images[] — the client derives them
        // at render time. Protect a thumbnail whenever its base original is still
        // referenced, otherwise the GC strips every card thumbnail after grace.
        const base = baseObjectPath(path);
        if (base !== path && referenced.has(base)) continue;

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
      tags: { component: 'cron', job: 'gc-uploads', area: 'cron', severity: 'warning' },
    });
    return cronError(`gc-uploads failed: ${result.error.message}`);
  }

  return NextResponse.json({
    success: true,
    ...result.data,
    processedAt: new Date().toISOString(),
  });
}
