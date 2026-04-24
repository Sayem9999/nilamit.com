/**
 * One-shot backfill: populate `currentBidderId` on every existing auction.
 *
 * Why: The bid transaction (src/services/bidding/bidding-service.ts) reads
 * `auction.currentBidderId` to determine the previous top bidder for outbid
 * notifications. New auctions (post-deploy) initialise this to null in
 * AuctionService.create, but pre-existing auctions in production lack the
 * field — so the first bid against an old auction would treat it as if there
 * had been no previous bidder, suppressing the outbid email.
 *
 * Run once after deploying the Batch 1 bidding fix:
 *   npx tsx scripts/backfill-current-bidder.ts
 *
 * Idempotent: skips auctions that already have the field set.
 */

import { db } from '../src/lib/db';

interface BidDoc {
  bidderId: string;
  amount:   number;
}

async function main() {
  console.log('[backfill] Scanning auctions...');

  const auctionsSnap = await db.collection('auctions').get();
  console.log(`[backfill] ${auctionsSnap.size} auctions total`);

  let processed = 0;
  let skipped   = 0;
  let updated   = 0;
  let noBids    = 0;
  let errors    = 0;

  for (const auctionDoc of auctionsSnap.docs) {
    processed++;
    const data = auctionDoc.data();

    // Skip if already set (including explicit null — both indicate the field
    // exists and was managed by post-deploy code).
    if (Object.prototype.hasOwnProperty.call(data, 'currentBidderId')) {
      skipped++;
      continue;
    }

    try {
      const topBidSnap = await db.collection('bids')
        .where('auctionId', '==', auctionDoc.id)
        .orderBy('amount', 'desc')
        .limit(1)
        .get();

      const currentBidderId = topBidSnap.empty
        ? null
        : (topBidSnap.docs[0].data() as BidDoc).bidderId;

      await auctionDoc.ref.update({ currentBidderId });

      if (currentBidderId === null) noBids++;
      updated++;

      if (processed % 50 === 0) {
        console.log(`[backfill] ${processed}/${auctionsSnap.size} processed (updated=${updated}, skipped=${skipped})`);
      }
    } catch (err) {
      errors++;
      console.error(`[backfill] auction ${auctionDoc.id} failed:`, err);
    }
  }

  console.log('[backfill] Done.');
  console.log(`  processed: ${processed}`);
  console.log(`  updated:   ${updated} (of which ${noBids} had no bids → null)`);
  console.log(`  skipped:   ${skipped} (already had currentBidderId)`);
  console.log(`  errors:    ${errors}`);
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
