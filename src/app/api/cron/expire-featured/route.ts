/**
 * POST /api/cron/expire-featured
 *
 * Hourly job: flip `isFeatured=false` on auctions whose `featuredUntil` has
 * passed, so a promotion auto-expires without manual intervention. Mirrors the
 * close-auctions batching pattern.
 */

import { db } from '@/lib/db';
import { verifyCronSecret } from '@/lib/cron-utils';
import { updateAuctionInIndex } from '@/lib/search-engine';
import { log } from '@/lib/logger';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  try {
    const now = new Date();
    let expired = 0;

    // Page through expired featured listings. Capped per run; the rest is
    // picked up next hour (a listing is flipped once, so it won't requeue).
    for (let batch = 0; batch < 20; batch++) {
      const snap = await db
        .collection('auctions')
        .where('isFeatured', '==', true)
        .where('featuredUntil', '<=', now)
        .limit(200)
        .get();

      if (snap.empty) break;

      const writer = db.batch();
      snap.docs.forEach((d) => {
        writer.update(d.ref, { isFeatured: false, updatedAt: now });
      });
      await writer.commit();

      // Best-effort index sync (no-op until the search engine is provisioned).
      await Promise.all(
        snap.docs.map((d) =>
          updateAuctionInIndex(d.id, { isFeatured: false }).catch(() => false),
        ),
      );

      expired += snap.docs.length;
      if (snap.docs.length < 200) break;
    }

    log.info('[Cron:expire-featured] done', { expired });
    return NextResponse.json({ success: true, expired, timestamp: new Date().toISOString() });
  } catch (error) {
    log.error('[Cron:expire-featured] Failed:', error, { area: 'cron', severity: 'warning' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
