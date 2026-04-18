/**
 * One-shot backfill: populate `auctionsWonCount` on every user doc by counting
 * SOLD auctions keyed by winnerId. Safe to re-run — it overwrites the field
 * with the computed count.
 *
 *   npx tsx scripts/backfill-auctions-won.ts
 */
import 'dotenv/config';
import { db } from '../src/lib/db';

async function main() {
  console.log('Scanning auctions for winners…');
  const snap = await db.collection('auctions')
    .where('winnerId', '!=', null)
    .get();

  const counts = new Map<string, number>();
  for (const d of snap.docs) {
    const w = d.data().winnerId as string | null | undefined;
    if (!w) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  console.log(`Found ${counts.size} winners across ${snap.size} auctions.`);

  // Batched writes (max 500 per batch)
  const entries = [...counts.entries()];
  for (let i = 0; i < entries.length; i += 450) {
    const batch = db.batch();
    for (const [uid, count] of entries.slice(i, i + 450)) {
      batch.set(
        db.collection('users').doc(uid),
        { auctionsWonCount: count, updatedAt: new Date() },
        { merge: true },
      );
    }
    await batch.commit();
    console.log(`  wrote ${Math.min(i + 450, entries.length)}/${entries.length}`);
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
