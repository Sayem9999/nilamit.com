
import { db } from './src/lib/db';

async function run() {
  const auctionId = 'RpZNegs3yahZskM9eYB';
  const snap = await db.collection('auctions').doc(auctionId).get();
  if (!snap.exists) {
    console.log('Auction not found');
    return;
  }
  const data = snap.data();
  console.log('Auction Data:', JSON.stringify(data, (key, value) => {
    if (value && value.toDate) return value.toDate().toISOString();
    return value;
  }, 2));
}

run().catch(console.error);
