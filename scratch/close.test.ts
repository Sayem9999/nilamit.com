
import { describe, it } from 'vitest';
import { db } from '../src/lib/db';
import { closeAuctionIfEnded } from '../src/lib/auction-logic';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

describe('Auction Debug', () => {
  it('closes the auction', async () => {
    const auctionId = 'RpZNegs3yahxZsKM9eYB';
    console.log(`Closing auction: ${auctionId}`);
    await closeAuctionIfEnded(auctionId);
    
    const snap = await db.collection('auctions').doc(auctionId).get();
    console.log(`New status: ${snap.get('status')}`);
  });
});
