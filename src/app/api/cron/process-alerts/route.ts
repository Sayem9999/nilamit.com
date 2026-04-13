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

    // Process TARGET_REACHED and PRICE_DROP alerts
    const activeAlerts = await prisma.alert.findMany({
      where: {
        isActive: true,
        type: { in: ['TARGET_REACHED', 'PRICE_DROP'] },
        auctionId: { not: null }
      },
      include: {
        auction: { select: { currentPrice: true, title: true } },
        user: { select: { email: true, name: true, id: true } }
      }
    });

    for (const alert of activeAlerts) {
      if (alert.auction && alert.thresholdPrice !== null) {
        const isTargetReached = alert.type === 'TARGET_REACHED' && alert.auction.currentPrice >= alert.thresholdPrice;
        const isPriceDropped = alert.type === 'PRICE_DROP' && alert.auction.currentPrice <= alert.thresholdPrice;

        if (isTargetReached || isPriceDropped) {
          // Condition met
          console.log(`[ALERT TRIGGERED] User ${alert.user.id}: ${alert.type} for '${alert.auction.title}'`);
          
          // Trigger Pusher
          await pusherServer.trigger(`user-${alert.user.id}`, 'price-alert', {
            auctionId: alert.auctionId,
            auctionTitle: alert.auction.title,
            amount: alert.auction.currentPrice,
            type: alert.type,
            threshold: alert.thresholdPrice
          }).catch(console.error);

          // Disable alert so it doesn't trigger again (One-time trigger)
          await prisma.alert.update({
            where: { id: alert.id },
            data: { isActive: false }
          });
          
          processedCount++;
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Processed ${processedCount} alerts successfully.`,
      processedCount
    });

  } catch (error) {
    console.error('[CRON ALERT ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
