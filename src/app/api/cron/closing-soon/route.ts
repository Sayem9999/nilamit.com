import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Resend } from 'resend';
import { AuctionStatus } from '@prisma/client';
import { pusherServer } from '@/lib/pusher-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) return NextResponse.json({ error: 'Resend API key missing' }, { status: 500 });

  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Find active auctions ending in the next hour that haven't been notified yet
    // Note: We might want a 'notifiedClosingSoon' flag in the Auction model for better scaling,
    // but for now we'll just process them based on timing.
    const auctions = await prisma.auction.findMany({
      where: {
        status: AuctionStatus.ACTIVE,
        endTime: {
          gt: now,
          lte: oneHourFromNow,
        },
      },
      include: {
        watchlist: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        },
        alerts: {
          where: { type: 'ENDING_SOON', isActive: true },
          select: { userId: true },
        },
      },
    });

    let sentCount = 0;

    for (const auction of auctions) {
      for (const entry of auction.watchlist) {
        if (entry.user.email) {
          const { auctionEndingSoonEmailHtml } = await import('@/lib/emails');
          const baseUrl = process.env.NEXTAUTH_URL || 'https://nilamit.com';
          await resend.emails.send({
            from: 'alerts@nilamit.com',
            to: entry.user.email,
            subject: `Closing Soon: ${auction.title}`,
            html: auctionEndingSoonEmailHtml(auction.title, auction.currentPrice, auction.id, baseUrl),
          });
          sentCount++;

          // Also push a real-time Pusher notification to this user
          await pusherServer.trigger(`user-${entry.user.id}`, 'ending-soon', {
            auctionId: auction.id,
            auctionTitle: auction.title,
            currentPrice: auction.currentPrice,
            endTime: auction.endTime,
          }).catch(console.error);
        }
      }

      // Push ending-soon to users who set an explicit Alert (may not be on watchlist)
      for (const alert of auction.alerts) {
        const alreadyNotified = auction.watchlist.some(w => w.user.id === alert.userId);
        if (!alreadyNotified) {
          await pusherServer.trigger(`user-${alert.userId}`, 'ending-soon', {
            auctionId: auction.id,
            auctionTitle: auction.title,
            currentPrice: auction.currentPrice,
            endTime: auction.endTime,
          }).catch(console.error);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      auctionsProcessed: auctions.length,
      emailsSent: sentCount
    });

  } catch (error) {
    console.error('[CRON CLOSING SOON ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
