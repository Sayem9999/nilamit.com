import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // 1. Security check (Internal/Cron only)
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    let processedCount = 0;

    // Process PRICE_DROP alerts
    const activePriceAlerts = await prisma.alert.findMany({
      where: {
        type: 'PRICE_DROP',
        isActive: true,
        thresholdPrice: { not: null },
        auctionId: { not: null }
      },
      include: {
        auction: { select: { currentPrice: true, title: true } },
        user: { select: { email: true, name: true } }
      }
    });

    for (const alert of activePriceAlerts) {
      if (alert.auction && alert.thresholdPrice !== null) {
        if (alert.auction.currentPrice <= alert.thresholdPrice) {
          // Condition met: Current price is at or below the threshold
          console.log(`[ALERT TRIGGERED] User ${alert.user.email}: Price for '${alert.auction.title}' dropped to ৳${alert.auction.currentPrice}`);
          
          // Disable alert so it doesn't trigger again
          await prisma.alert.update({
            where: { id: alert.id },
            data: { isActive: false }
          });
          
          processedCount++;
        }
      }
    }

    return NextResponse.json({ 
      message: `Processed ${processedCount} alerts successfully.`,
      processedCount
    });

  } catch (error) {
    console.error('[CRON ALERT ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
