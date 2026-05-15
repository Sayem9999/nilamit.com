import { closeAllEndedAuctions } from '@/lib/auction-logic';
import { verifyCronSecret } from '@/lib/cron-utils';
import { log } from '@/lib/logger';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  try {
    log.info('[Cron:close-auctions] Starting batch closure...');
    await closeAllEndedAuctions();
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    log.error('[Cron:close-auctions] Failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
