
import { describe, it } from 'vitest';
import { db } from '../src/lib/db';

describe('Auction Debug', () => {
  it('logs auction data', async () => {
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
  });
});
