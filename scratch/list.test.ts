
import { describe, it } from 'vitest';
import { db } from '../src/lib/db';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

describe('Auction Debug', () => {
  it('lists auctions', async () => {
    const snap = await db.collection('auctions').limit(10).get();
    console.log(`Found ${snap.size} auctions`);
    snap.docs.forEach(doc => {
      console.log(`ID: ${doc.id}, Status: ${doc.get('status')}, Title: ${doc.get('title')}`);
    });
  });
});
