import { closeAuctionIfEnded } from '@/lib/auction-logic';
import { verifyCronSecret } from '@/lib/cron-utils';
import { log } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // 1. Auth gate (reusing the cron secret for Cloud Tasks)
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  try {
    const { auctionId } = await req.json();
    if (!auctionId) {
      return NextResponse.json({ error: 'Missing auctionId' }, { status: 400 });
    }

    log.info(`[Tasks:close-auction] Processing task for auction ${auctionId}`);
    
    // We only process this specific auction
    await closeAuctionIfEnded(auctionId);
    revalidatePath('/auctions');

    return NextResponse.json({ success: true, closedAt: new Date().toISOString() });
  } catch (error) {
    log.error('[Tasks:close-auction] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
