import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import type { AuctionFilters, CreateAuctionInput } from '@/types';
import { closeAuctionIfEnded, closeAllEndedAuctions } from '@/lib/auction-logic';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // 1. Security check (Internal/Cron only)
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const now = new Date();

    // Use shared utility to process closure
    await closeAllEndedAuctions();

    return NextResponse.json({ 
      message: `Cron job completed successfully at ${now.toISOString()}.`,
    });

  } catch (error) {
    console.error('[CRON ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
