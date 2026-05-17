
import { closeAuctionIfEnded } from './src/lib/auction-logic';

async function run() {
  const auctionId = 'RpZNegs3yahZskM9eYB';
  console.log(`Attempting to close auction: ${auctionId}`);
  await closeAuctionIfEnded(auctionId);
  console.log('Done.');
}

run().catch(console.error);
